import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'

const router = Router()
router.use(authenticate)

// List time entries
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, project, is_billed, from, to, page = 1, limit = 50 } = (req as any).query
    let query = supabase
      .from('time_entries')
      .select(`*, clients(id, name)`, { count: 'exact' })
      .eq('user_id', (req as any).user!.id)
      .order('date', { ascending: false })
      .range((+page - 1) * +limit, +page * +limit - 1)
    if (client_id) query = query.eq('client_id', client_id)
    if (project) query = query.ilike('project', `%${project}%`)
    if (is_billed !== undefined) query = query.eq('is_billed', is_billed === 'true')
    if (from) query = query.gte('date', from as string)
    if (to) query = query.lte('date', to as string)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })

    // Summary stats
    const total_hours = (data || []).reduce((s, e) => s + e.hours, 0)
    const total_amount = (data || []).reduce((s, e) => s + e.amount, 0)
    const unbilled_amount = (data || []).filter(e => !e.is_billed && e.is_billable).reduce((s, e) => s + e.amount, 0)

    return res.json({ data, total: count, page: +page, limit: +limit, summary: { total_hours, total_amount, unbilled_amount } })
  } catch {
    return res.status(500).json({ error: 'Failed to fetch time entries' })
  }
})

// Get single entry
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('time_entries').select(`*, clients(id, name)`)
      .eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).single()
    if (error) return res.status(404).json({ error: 'Entry not found' })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch entry' })
  }
})

// Create time entry
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { hours, hourly_rate, started_at, ended_at, ...rest } = (req as any).body
    if (!hours || !hourly_rate) return res.status(400).json({ error: 'Hours and hourly rate are required' })

    // Auto-calculate hours from start/end if provided
    let finalHours = +hours
    if (started_at && ended_at) {
      const diff = (new Date(ended_at).getTime() - new Date(started_at).getTime()) / 3600000
      finalHours = Math.round(diff * 100) / 100
    }

    const { data, error } = await supabase.from('time_entries')
      .insert({ ...rest, user_id: (req as any).user!.id, hours: finalHours, hourly_rate: +hourly_rate, started_at, ended_at })
      .select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.status(201).json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to create time entry' })
  }
})

// Update time entry
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase.from('time_entries')
      .update((req as any).body).eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to update entry' })
  }
})

// Delete time entry
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await supabase.from('time_entries').delete().eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id)
    return res.json({ message: 'Entry deleted' })
  } catch {
    return res.status(500).json({ error: 'Failed to delete entry' })
  }
})

// Convert time entries to invoice
router.post('/convert-to-invoice', async (req: AuthRequest, res: Response) => {
  try {
    const { entry_ids, client_id, due_days = 30 } = (req as any).body
    if (!entry_ids?.length || !client_id) {
      return res.status(400).json({ error: 'entry_ids and client_id are required' })
    }

    const { data: entries } = await supabase.from('time_entries')
      .select('*').in('id', entry_ids).eq('user_id', (req as any).user!.id).eq('is_billed', false)
    if (!entries?.length) return res.status(400).json({ error: 'No unbilled entries found' })

    // Build invoice
    const { data: profile } = await supabase.from('profiles').select('default_tax_rate, default_currency').eq('id', (req as any).user!.id).single()
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', (req as any).user!.id)
    const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + due_days)

    const subtotal = entries.reduce((s, e) => s + e.amount, 0)
    const taxRate = profile?.default_tax_rate || 20
    const taxAmount = subtotal * (taxRate / 100)
    const total = subtotal + taxAmount

    const { data: invoice, error } = await supabase.from('invoices').insert({
      user_id: (req as any).user!.id, client_id,
      invoice_number: invoiceNumber, status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      currency: profile?.default_currency || 'GBP',
      subtotal, tax_rate: taxRate, tax_amount: taxAmount,
      discount_percent: 0, discount_amount: 0, total
    }).select().single()
    if (error) return res.status(400).json({ error: error.message })

    // Create invoice line items from time entries
    const items = entries.map((e, idx) => ({
      invoice_id: invoice.id,
      description: `${e.project ? `[${e.project}] ` : ''}${e.description} (${e.hours}h @ £${e.hourly_rate}/h)`,
      quantity: e.hours, unit_price: e.hourly_rate,
      tax_rate: 0, amount: e.amount, sort_order: idx
    }))
    await supabase.from('invoice_items').insert(items)

    // Mark entries as billed
    await supabase.from('time_entries').update({ is_billed: true, invoice_id: invoice.id }).in('id', entry_ids)

    return res.status(201).json({ invoice_id: invoice.id, invoice_number: invoiceNumber, total_hours: entries.reduce((s, e) => s + e.hours, 0), total_amount: subtotal })
  } catch {
    return res.status(500).json({ error: 'Failed to convert to invoice' })
  }
})

// Get summary by project/client
router.get('/summary/by-client', async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabase.from('time_entries').select(`*, clients(name)`).eq('user_id', (req as any).user!.id)
    const byClient: Record<string, any> = {}
    data?.forEach(e => {
      const key = e.client_id || 'no-client'
      const name = e.clients?.name || 'No client'
      if (!byClient[key]) byClient[key] = { client_id: e.client_id, client_name: name, total_hours: 0, total_amount: 0, unbilled_amount: 0 }
      byClient[key].total_hours += e.hours
      byClient[key].total_amount += e.amount
      if (!e.is_billed && e.is_billable) byClient[key].unbilled_amount += e.amount
    })
    return res.json(Object.values(byClient))
  } catch {
    return res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

export default router
