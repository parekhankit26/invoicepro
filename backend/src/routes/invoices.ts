import { Router, Response } from 'express'
import { calculateTax } from '../lib/taxCalculator'
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { pdfService } from '../services/pdfService'
import { emailService } from '../services/emailService'
import { stripeService } from '../services/stripeService'

const router = Router()
router.use(authenticate)

router.get('/', async (req: AuthRequest, res: Response) => {
  const { status, client_id, search, page = 1, limit = 20 } = (req as any).query
  let query = supabase.from('invoices').select('*, clients(id,name,email), invoice_items(*)', { count: 'exact' }).eq('user_id', (req as any).user!.id).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
  if (status) query = query.eq('status', status)
  if (client_id) query = query.eq('client_id', client_id)
  if (search) query = query.or(`invoice_number.ilike.%${search}%,bill_to.ilike.%${search}%`)
  const { data, error, count } = await query
  if (error) return res.status(400).json({ error: error.message })
  return res.json({ data, total: count, page: +page, limit: +limit })
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('invoices').select('*, clients(*), invoice_items(*)').eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).single()
  if (error) return res.status(404).json({ error: 'Invoice not found' })
  return res.json(data)
})

router.post('/', requirePermission('create_invoices'), async (req: AuthRequest, res: Response) => {
  const { items = [], ...invoiceData } = (req as any).body
  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0)
  const taxResult = calculateTax(subtotal, invoiceData.discount_percent || 0, invoiceData.tax_rate || 0, invoiceData.country_code || 'GB', invoiceData.tax_type || 'CGST_SGST')
  const discountAmount = taxResult.discountAmount
  const taxAmount = taxResult.totalTax
  const total = taxResult.total
  if (!invoiceData.invoice_number) {
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', (req as any).user!.id)
    invoiceData.invoice_number = `INV-${String((count || 0) + 1).padStart(4, '0')}`
  }
  const { data: invoice, error } = await supabase.from('invoices').insert({ ...invoiceData, user_id: (req as any).user!.id, subtotal, tax_amount: taxAmount, discount_amount: discountAmount, total, tax_lines: taxResult.taxLines, taxable_amount: taxResult.taxableAmount, tax_summary_label: taxResult.taxSummaryLabel }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  if (items.length) {
    await supabase.from('invoice_items').insert(items.map((item: any, idx: number) => ({ invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, tax_rate: item.tax_rate || 0, amount: item.quantity * item.unit_price, sort_order: idx })))
  }
  return res.status(201).json(invoice)
})

router.put('/:id', requirePermission('create_invoices'), async (req: AuthRequest, res: Response) => {
  const { items, clients, profiles, invoice_items, id, user_id, created_at, ...invoiceData } = (req as any).body
  // Remove any nested objects that aren't real columns
  Object.keys(invoiceData).forEach(key => {
    if (typeof invoiceData[key] === 'object' && invoiceData[key] !== null && !Array.isArray(invoiceData[key])) {
      delete invoiceData[key]
    }
  })
  const { data: existing } = await supabase.from('invoices').select('id').eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).single()
  if (!existing) return res.status(404).json({ error: 'Invoice not found' })
  if (items) {
    const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0)
    invoiceData.subtotal = subtotal
    const taxResult = calculateTax(subtotal, invoiceData.discount_percent || 0, invoiceData.tax_rate || 0, invoiceData.country_code || 'GB', invoiceData.tax_type || 'CGST_SGST')
    invoiceData.discount_amount = taxResult.discountAmount
    invoiceData.taxable_amount = taxResult.taxableAmount
    invoiceData.tax_amount = taxResult.totalTax
    invoiceData.tax_lines = taxResult.taxLines
    invoiceData.tax_summary_label = taxResult.taxSummaryLabel
    invoiceData.total = taxResult.total
    await supabase.from('invoice_items').delete().eq('invoice_id', (req as any).params.id)
    await supabase.from('invoice_items').insert(items.map((item: any, idx: number) => ({ invoice_id: (req as any).params.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, tax_rate: item.tax_rate || 0, amount: item.quantity * item.unit_price, sort_order: idx })))
  }
  const { data, error } = await supabase.from('invoices').update(invoiceData).eq('id', (req as any).params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

router.delete('/:id', requirePermission('create_invoices'), async (req: AuthRequest, res: Response) => {
  const { error } = await supabase.from('invoices').delete().eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id)
  if (error) return res.status(400).json({ error: error.message })
  return res.json({ message: 'Invoice deleted' })
})

// PDF - returns HTML that can be printed to PDF
router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase.from('invoices').select('*').eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).single()
    if (invErr || !invoice) return res.status(404).json({ error: 'Invoice not found' })
    
    // Fetch related data separately (avoids join schema cache issues)
    const [itemsRes, clientRes, profileRes] = await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('sort_order', { ascending: true }),
      invoice.client_id ? supabase.from('clients').select('*').eq('id', invoice.client_id).single() : Promise.resolve({ data: null }),
      supabase.from('profiles').select('*').eq('id', (req as any).user!.id).single()
    ])
    
    const items = itemsRes.data || []
    const client = clientRes.data || {}
    const profile = profileRes.data || {}
    
    const invoiceData: any = {
      ...invoice,
      items,
      company_name: profile.company_name || 'Your Company',
      from_address: profile.company_address || '',
      from_email: profile.email || '',
      from_tax: profile.tax_number ? `VAT: ${profile.tax_number}` : '',
      client_name: client.name || invoice.bill_to || 'Client',
      client_email: client.email || '',
      client_address: client.address || '',
      invoice_template: profile.invoice_template || null,
      bank_account_details: profile.bank_account_details || null,
    }
    
    const pdfBuffer = await pdfService.generateInvoicePDF(invoiceData)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`)
    res.setHeader('Content-Length', pdfBuffer.length.toString())
    return res.send(pdfBuffer)
  } catch(e: any) {
    console.error('PDF generation error:', e.message, e.stack)
    return res.status(500).json({ error: 'Failed to generate PDF: ' + e.message })
  }
})

router.post('/:id/send', async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice, error: invSendErr } = await supabase.from('invoices').select('*, clients(*), invoice_items(*)').eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).single()
    if (invSendErr || !invoice) {
      console.error('Invoice send lookup error:', invSendErr?.message)
      return res.status(404).json({ error: 'Invoice not found' })
    }
    // Fetch profile separately to avoid cross-schema join issues
    const { data: invProfile } = await supabase.from('profiles').select('company_name, full_name, company_address, company_phone, tax_number, email, invoice_template, bank_account_details').eq('id', (req as any).user!.id).single()
    ;(invoice as any).profiles = invProfile
    if (!invoice.clients?.email) return res.status(400).json({ error: 'Client has no email address. Add one in the client profile first.' })
    
    let paymentLink = invoice.stripe_payment_link
    try { paymentLink = await stripeService.createPaymentLink(invoice); await supabase.from('invoices').update({ stripe_payment_link: paymentLink }).eq('id', invoice.id) } catch(e) {}

    try {
      // Build invoice data with all fields the PDF renderer needs
      const invoiceForPdf: any = {
        ...invoice,
        items: invoice.invoice_items || [],
        company_name: invProfile?.company_name || invProfile?.full_name || 'Your Company',
        from_address: invProfile?.company_address || '',
        from_email: invProfile?.email || '',
        from_tax: invProfile?.tax_number ? `VAT: ${invProfile.tax_number}` : '',
        client_name: invoice.clients?.name || '',
        client_email: invoice.clients?.email || '',
        client_address: invoice.clients?.address || '',
        stripe_payment_link: paymentLink,
        invoice_template: invProfile?.invoice_template || null,
        bank_account_details: invProfile?.bank_account_details || null,
      }
      const pdfBuffer = await pdfService.generateInvoicePDF(invoiceForPdf)
      await emailService.sendInvoice({ to: invoice.clients.email, clientName: invoice.clients.name, invoice: invoiceForPdf, pdfBuffer })
      await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice.id)
      return res.json({ message: `Invoice sent to ${invoice.clients.email}`, payment_link: paymentLink, email_sent: true })
    } catch (emailErr: any) {
      console.error('Email send failed:', emailErr)
      await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice.id)
      return res.json({ message: `Invoice marked as sent but email delivery failed: ${emailErr.message}`, email_sent: false })
    }
  } catch (err: any) {
    console.error('Send invoice error:', err)
    return res.status(500).json({ error: err.message || 'Failed to send invoice' })
  }
})

router.post('/:id/mark-paid', async (req: AuthRequest, res: Response) => {
  const { amount, method = 'manual', reference, notes } = (req as any).body
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).single()
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  const paymentAmount = amount || invoice.total
  await supabase.from('payments').insert({ user_id: (req as any).user!.id, invoice_id: invoice.id, amount: paymentAmount, currency: invoice.currency, method, reference, notes, status: 'completed' })
  await supabase.from('invoices').update({ status: 'paid', amount_paid: paymentAmount, paid_at: new Date().toISOString() }).eq('id', invoice.id)
  return res.json({ message: 'Invoice marked as paid' })
})

router.post('/:id/mark-unpaid', async (req: AuthRequest, res: Response) => {
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).single()
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (invoice.status !== 'paid') return res.status(400).json({ error: 'Invoice is not paid' })
  // Remove the payment record for this invoice
  await supabase.from('payments').delete().eq('invoice_id', invoice.id).eq('user_id', (req as any).user!.id)
  // Revert to sent if it was previously sent, otherwise draft
  const revertStatus = invoice.sent_at ? 'sent' : 'draft'
  const { data, error } = await supabase.from('invoices').update({ status: revertStatus, amount_paid: 0, paid_at: null }).eq('id', (req as any).params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json({ message: 'Invoice marked as unpaid', data })
})

router.post('/:id/payment-link', async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice } = await supabase.from('invoices').select('*, clients(*)').eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).single()
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (!process.env.STRIPE_SECRET_KEY) return res.status(400).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.' })
    const paymentLink = await stripeService.createPaymentLink(invoice)
    await supabase.from('invoices').update({ stripe_payment_link: paymentLink }).eq('id', invoice.id)
    return res.json({ payment_link: paymentLink })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create payment link' })
  }
})

export default router
