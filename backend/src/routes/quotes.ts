import { Router, Response, Request } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { emailService } from '../services/emailService'
import { pdfService } from '../services/pdfService'
import crypto from 'crypto'

const router = Router()

// Public route — client approve/decline quote via token
router.get('/portal/:token', async (req: Request, res: Response) => {
  try {
    const { data: quote, error } = await supabase
      .from('quotes')
      .select(`*, clients(*), quote_items(*), profiles(company_name, full_name, company_address, company_phone, tax_number)`)
      .eq('client_token', req.params.token)
      .single()
    if (error || !quote) return res.status(404).json({ error: 'Quote not found' })
    // Track view
    await supabase.from('quotes').update({ status: quote.status === 'draft' ? 'sent' : quote.status }).eq('id', quote.id)
    return res.json(quote)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch quote' })
  }
})

router.post('/portal/:token/respond', async (req: Request, res: Response) => {
  try {
    const { action, message } = req.body // action: 'accept' | 'decline'
    const { data: quote } = await supabase
      .from('quotes').select('*').eq('client_token', req.params.token).single()
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    if (!['accepted', 'declined'].includes(action === 'accept' ? 'accepted' : 'declined')) {
      return res.status(400).json({ error: 'Invalid action' })
    }
    const updateData: any = {
      status: action === 'accept' ? 'accepted' : 'declined',
      ...(action === 'accept' ? { accepted_at: new Date().toISOString() } : { declined_at: new Date().toISOString() })
    }
    await supabase.from('quotes').update(updateData).eq('id', quote.id)
    return res.json({ message: `Quote ${action === 'accept' ? 'accepted' : 'declined'} successfully` })
  } catch {
    return res.status(500).json({ error: 'Failed to respond to quote' })
  }
})

// Protected routes
router.use(authenticate)

// List quotes
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, client_id, page = 1, limit = 20 } = req.query
    let query = supabase
      .from('quotes')
      .select(`*, clients(id, name, email), quote_items(*)`, { count: 'exact' })
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range((+page - 1) * +limit, +page * +limit - 1)
    if (status) query = query.eq('status', status)
    if (client_id) query = query.eq('client_id', client_id)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count, page: +page, limit: +limit })
  } catch {
    return res.status(500).json({ error: 'Failed to fetch quotes' })
  }
})

// Get single quote
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`*, clients(*), quote_items(*)`)
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .single()
    if (error) return res.status(404).json({ error: 'Quote not found' })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch quote' })
  }
})

// Create quote
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { items = [], ...quoteData } = req.body
    const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0)
    const taxAmount = subtotal * ((quoteData.tax_rate || 0) / 100)
    const discountAmount = subtotal * ((quoteData.discount_percent || 0) / 100)
    const total = subtotal + taxAmount - discountAmount

    // Auto-generate quote number
    if (!quoteData.quote_number) {
      const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('user_id', req.user!.id)
      quoteData.quote_number = `QTE-${String((count || 0) + 1).padStart(4, '0')}`
    }

    // Generate client token for portal
    const clientToken = crypto.randomBytes(32).toString('hex')

    const { data: quote, error } = await supabase
      .from('quotes')
      .insert({ ...quoteData, user_id: req.user!.id, subtotal, tax_amount: taxAmount, discount_amount: discountAmount, total, client_token: clientToken })
      .select().single()
    if (error) return res.status(400).json({ error: error.message })

    if (items.length) {
      const lineItems = items.map((item: any, idx: number) => ({
        quote_id: quote.id, description: item.description,
        quantity: item.quantity, unit_price: item.unit_price,
        tax_rate: item.tax_rate || 0, amount: item.quantity * item.unit_price, sort_order: idx
      }))
      await supabase.from('quote_items').insert(lineItems)
    }
    return res.status(201).json(quote)
  } catch {
    return res.status(500).json({ error: 'Failed to create quote' })
  }
})

// Update quote
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { items, ...quoteData } = req.body
    const { data: existing } = await supabase.from('quotes').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
    if (!existing) return res.status(404).json({ error: 'Quote not found' })

    if (items) {
      const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0)
      const taxAmount = subtotal * ((quoteData.tax_rate || 0) / 100)
      const discountAmount = subtotal * ((quoteData.discount_percent || 0) / 100)
      quoteData.subtotal = subtotal
      quoteData.tax_amount = taxAmount
      quoteData.discount_amount = discountAmount
      quoteData.total = subtotal + taxAmount - discountAmount
      await supabase.from('quote_items').delete().eq('quote_id', req.params.id)
      const lineItems = items.map((item: any, idx: number) => ({
        quote_id: req.params.id, description: item.description,
        quantity: item.quantity, unit_price: item.unit_price,
        tax_rate: item.tax_rate || 0, amount: item.quantity * item.unit_price, sort_order: idx
      }))
      await supabase.from('quote_items').insert(lineItems)
    }
    const { data, error } = await supabase.from('quotes').update(quoteData).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to update quote' })
  }
})

// Delete quote
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase.from('quotes').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ message: 'Quote deleted' })
  } catch {
    return res.status(500).json({ error: 'Failed to delete quote' })
  }
})

// Send quote by email
router.post('/:id/send', async (req: AuthRequest, res: Response) => {
  try {
    const { data: quote } = await supabase
      .from('quotes').select(`*, clients(*), quote_items(*), profiles(*)`)
      .eq('id', req.params.id).eq('user_id', req.user!.id).single()
    if (!quote) return res.status(404).json({ error: 'Quote not found' })

    const portalUrl = `${process.env.APP_URL}/quotes/portal/${quote.client_token}`
    await emailService.sendQuote({ to: quote.clients.email, clientName: quote.clients.name, quote, portalUrl })
    await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quote.id)
    return res.json({ message: 'Quote sent successfully', portal_url: portalUrl })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to send quote' })
  }
})

// Convert quote to invoice
router.post('/:id/convert', async (req: AuthRequest, res: Response) => {
  try {
    const { data: quote } = await supabase
      .from('quotes').select(`*, quote_items(*)`).eq('id', req.params.id).eq('user_id', req.user!.id).single()
    if (!quote) return res.status(404).json({ error: 'Quote not found' })
    if (quote.status !== 'accepted') return res.status(400).json({ error: 'Only accepted quotes can be converted' })

    // Get next invoice number
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', req.user!.id)
    const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const { data: invoice, error } = await supabase.from('invoices').insert({
      user_id: req.user!.id, client_id: quote.client_id,
      invoice_number: invoiceNumber, status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      currency: quote.currency, subtotal: quote.subtotal,
      tax_rate: quote.tax_rate, tax_amount: quote.tax_amount,
      discount_percent: quote.discount_percent, discount_amount: quote.discount_amount,
      total: quote.total, notes: quote.notes, terms: quote.terms
    }).select().single()
    if (error) return res.status(400).json({ error: error.message })

    const items = quote.quote_items.map((item: any) => ({
      invoice_id: invoice.id, description: item.description,
      quantity: item.quantity, unit_price: item.unit_price,
      tax_rate: item.tax_rate, amount: item.amount, sort_order: item.sort_order
    }))
    await supabase.from('invoice_items').insert(items)
    await supabase.from('quotes').update({ status: 'converted', converted_invoice_id: invoice.id }).eq('id', quote.id)

    return res.json({ message: 'Quote converted to invoice', invoice_id: invoice.id, invoice_number: invoiceNumber })
  } catch {
    return res.status(500).json({ error: 'Failed to convert quote' })
  }
})

export default router
