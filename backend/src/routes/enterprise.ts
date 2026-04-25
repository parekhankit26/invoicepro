import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import crypto from 'crypto'

const router = Router()
router.use(authenticate)

// ── API KEYS ─────────────────────────────────────────────

router.get('/api-keys', async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabase.from('api_keys').select('id,name,key_prefix,permissions,last_used,expires_at,is_active,request_count,created_at')
      .eq('user_id', req.user!.id).order('created_at', { ascending: false })
    return res.json(data || [])
  } catch {
    return res.status(500).json({ error: 'Failed to fetch API keys' })
  }
})

router.post('/api-keys', async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', req.user!.id).single()
    if (!['enterprise'].includes(profile?.plan || '')) {
      return res.status(403).json({ error: 'API keys require Enterprise plan' })
    }
    const { name, permissions = ['invoices:read'], expires_at } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })

    const rawKey = `ipro_${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.slice(0, 12)

    const { data, error } = await supabase.from('api_keys').insert({
      user_id: req.user!.id, name, key_hash: keyHash, key_prefix: keyPrefix, permissions, expires_at
    }).select('id,name,key_prefix,permissions,expires_at,created_at').single()
    if (error) return res.status(400).json({ error: error.message })

    // Return the raw key ONCE — not stored again
    return res.status(201).json({ ...data, api_key: rawKey, warning: 'Save this key now — it will not be shown again' })
  } catch {
    return res.status(500).json({ error: 'Failed to create API key' })
  }
})

router.delete('/api-keys/:id', async (req: AuthRequest, res: Response) => {
  try {
    await supabase.from('api_keys').update({ is_active: false }).eq('id', req.params.id).eq('user_id', req.user!.id)
    return res.json({ message: 'API key revoked' })
  } catch {
    return res.status(500).json({ error: 'Failed to revoke key' })
  }
})

// ── WHITE LABEL ──────────────────────────────────────────

router.get('/white-label', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase.from('white_label_settings').select('*').eq('user_id', req.user!.id).single()
    if (error) return res.json(null)
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch white label settings' })
  }
})

router.put('/white-label', async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', req.user!.id).single()
    if (profile?.plan !== 'enterprise') {
      return res.status(403).json({ error: 'White label requires Enterprise plan' })
    }
    const allowed = ['brand_name','brand_logo_url','brand_primary_color','brand_accent_color','custom_domain','custom_email_from','custom_email_name','invoice_footer','hide_powered_by']
    const updates: Record<string, any> = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })

    const { data, error } = await supabase.from('white_label_settings')
      .upsert({ user_id: req.user!.id, ...updates }, { onConflict: 'user_id' }).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to update white label settings' })
  }
})

// ── TAX REPORTS ──────────────────────────────────────────

router.get('/tax-report', async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = req.query
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required (YYYY-MM-DD)' })

    const [invoicesRes, expensesRes] = await Promise.all([
      supabase.from('invoices').select('total, tax_amount, tax_rate, status, paid_at')
        .eq('user_id', req.user!.id).eq('status', 'paid')
        .gte('paid_at', `${from}T00:00:00`).lte('paid_at', `${to}T23:59:59`),
      supabase.from('expenses').select('amount, tax_amount')
        .eq('user_id', req.user!.id).gte('date', from as string).lte('date', to as string)
    ])

    const invoices = invoicesRes.data || []
    const expenses = expensesRes.data || []

    const totalRevenue = invoices.reduce((s, i) => s + i.total, 0)
    const vatCollected = invoices.reduce((s, i) => s + (i.tax_amount || 0), 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const vatReclaimable = expenses.reduce((s, e) => s + (e.tax_amount || 0), 0)
    const netVat = vatCollected - vatReclaimable
    const netProfit = totalRevenue - vatCollected - totalExpenses + vatReclaimable

    return res.json({
      period: { from, to },
      revenue: {
        gross: totalRevenue,
        net: totalRevenue - vatCollected,
        vat_collected: vatCollected,
        invoice_count: invoices.length
      },
      expenses: {
        total: totalExpenses,
        vat_reclaimable: vatReclaimable,
        net: totalExpenses - vatReclaimable
      },
      vat: {
        collected: vatCollected,
        reclaimable: vatReclaimable,
        net_payable: Math.max(netVat, 0),
        net_reclaimable: netVat < 0 ? Math.abs(netVat) : 0
      },
      net_profit: netProfit,
      quarterly_breakdown: buildQuarterlyBreakdown(invoices, expenses, from as string, to as string)
    })
  } catch {
    return res.status(500).json({ error: 'Failed to generate tax report' })
  }
})

// ── INVOICE VIEW TRACKING ────────────────────────────────

router.get('/invoice-analytics/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice } = await supabase.from('invoices').select('id').eq('id', req.params.invoiceId).eq('user_id', req.user!.id).single()
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    const { data: views } = await supabase.from('invoice_views').select('*')
      .eq('invoice_id', req.params.invoiceId).order('viewed_at', { ascending: false })

    return res.json({
      total_views: views?.length || 0,
      first_viewed: views?.[views.length - 1]?.viewed_at || null,
      last_viewed: views?.[0]?.viewed_at || null,
      views: views || []
    })
  } catch {
    return res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

// ── LATE PAYMENT FEES ────────────────────────────────────

router.post('/late-fee/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { fee_percent = 2 } = req.body
    const { data: invoice } = await supabase.from('invoices').select('*')
      .eq('id', req.params.invoiceId).eq('user_id', req.user!.id).single()
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' })

    const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000)
    if (daysOverdue <= 0) return res.status(400).json({ error: 'Invoice is not yet overdue' })

    const monthsOverdue = Math.ceil(daysOverdue / 30)
    const lateFeeAmount = invoice.total * (fee_percent / 100) * monthsOverdue
    const newTotal = invoice.total + lateFeeAmount

    const { data, error } = await supabase.from('invoices')
      .update({ late_fee_percent: fee_percent, late_fee_amount: lateFeeAmount, total: newTotal })
      .eq('id', req.params.invoiceId).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ ...data, days_overdue: daysOverdue, months_overdue: monthsOverdue, late_fee_added: lateFeeAmount })
  } catch {
    return res.status(500).json({ error: 'Failed to apply late fee' })
  }
})

// ── XERO / QUICKBOOKS EXPORT ─────────────────────────────

router.get('/export/:format', async (req: AuthRequest, res: Response) => {
  try {
    const { format } = req.params // 'csv' | 'xero' | 'quickbooks'
    const { from, to } = req.query

    const { data: invoices } = await supabase.from('invoices')
      .select(`*, clients(name, email, address)`)
      .eq('user_id', req.user!.id)
      .gte('created_at', from ? `${from}T00:00:00` : '2020-01-01')
      .lte('created_at', to ? `${to}T23:59:59` : new Date().toISOString())
      .order('created_at')

    if (format === 'csv') {
      const headers = ['Invoice Number', 'Client', 'Issue Date', 'Due Date', 'Subtotal', 'Tax', 'Total', 'Status', 'Currency']
      const rows = (invoices || []).map(inv => [
        inv.invoice_number, inv.clients?.name || '', inv.issue_date, inv.due_date,
        inv.subtotal, inv.tax_amount, inv.total, inv.status, inv.currency
      ])
      const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="invoices-export-${from || 'all'}.csv"`)
      return res.send(csv)
    }

    if (format === 'xero') {
      // Xero CSV format
      const headers = ['ContactName','EmailAddress','InvoiceNumber','InvoiceDate','DueDate','Description','Quantity','UnitAmount','AccountCode','TaxType','Currency']
      const rows = (invoices || []).map(inv => [
        inv.clients?.name || '', inv.clients?.email || '', inv.invoice_number,
        inv.issue_date, inv.due_date, 'Professional Services', 1,
        inv.subtotal, '200', inv.tax_rate > 0 ? 'TAX001' : 'NONE', inv.currency
      ])
      const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="xero-export.csv"`)
      return res.send(csv)
    }

    return res.status(400).json({ error: 'Invalid format. Use: csv, xero, quickbooks' })
  } catch {
    return res.status(500).json({ error: 'Failed to export' })
  }
})

function buildQuarterlyBreakdown(invoices: any[], expenses: any[], from: string, to: string) {
  const quarters: Record<string, any> = {}
  invoices.forEach(inv => {
    if (!inv.paid_at) return
    const d = new Date(inv.paid_at)
    const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`
    if (!quarters[q]) quarters[q] = { revenue: 0, vat_collected: 0, expenses: 0, vat_reclaimable: 0 }
    quarters[q].revenue += inv.total
    quarters[q].vat_collected += inv.tax_amount || 0
  })
  return quarters
}

export default router
