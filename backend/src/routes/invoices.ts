import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { pdfService } from '../services/pdfService'
import { emailService } from '../services/emailService'
import { stripeService } from '../services/stripeService'

const router = Router()
router.use(authenticate)

router.get('/', async (req: AuthRequest, res: Response) => {
  const { status, client_id, search, page = 1, limit = 20 } = req.query
  let query = supabase.from('invoices').select('*, clients(id,name,email), invoice_items(*)', { count: 'exact' }).eq('user_id', req.user!.id).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
  if (status) query = query.eq('status', status)
  if (client_id) query = query.eq('client_id', client_id)
  if (search) query = query.ilike('invoice_number', `%${search}%`)
  const { data, error, count } = await query
  if (error) return res.status(400).json({ error: error.message })
  return res.json({ data, total: count, page: +page, limit: +limit })
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('invoices').select('*, clients(*), invoice_items(*)').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (error) return res.status(404).json({ error: 'Invoice not found' })
  return res.json(data)
})

router.post('/', async (req: AuthRequest, res: Response) => {
  const { items = [], ...invoiceData } = req.body
  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0)
  const taxAmount = subtotal * ((invoiceData.tax_rate || 0) / 100)
  const discountAmount = subtotal * ((invoiceData.discount_percent || 0) / 100)
  const total = subtotal + taxAmount - discountAmount
  if (!invoiceData.invoice_number) {
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', req.user!.id)
    invoiceData.invoice_number = `INV-${String((count || 0) + 1).padStart(4, '0')}`
  }
  const { data: invoice, error } = await supabase.from('invoices').insert({ ...invoiceData, user_id: req.user!.id, subtotal, tax_amount: taxAmount, discount_amount: discountAmount, total }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  if (items.length) {
    await supabase.from('invoice_items').insert(items.map((item: any, idx: number) => ({ invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, tax_rate: item.tax_rate || 0, amount: item.quantity * item.unit_price, sort_order: idx })))
  }
  return res.status(201).json(invoice)
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { items, ...invoiceData } = req.body
  const { data: existing } = await supabase.from('invoices').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!existing) return res.status(404).json({ error: 'Invoice not found' })
  if (items) {
    const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0)
    invoiceData.subtotal = subtotal
    invoiceData.tax_amount = subtotal * ((invoiceData.tax_rate || 0) / 100)
    invoiceData.discount_amount = subtotal * ((invoiceData.discount_percent || 0) / 100)
    invoiceData.total = invoiceData.subtotal + invoiceData.tax_amount - invoiceData.discount_amount
    await supabase.from('invoice_items').delete().eq('invoice_id', req.params.id)
    await supabase.from('invoice_items').insert(items.map((item: any, idx: number) => ({ invoice_id: req.params.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, tax_rate: item.tax_rate || 0, amount: item.quantity * item.unit_price, sort_order: idx })))
  }
  const { data, error } = await supabase.from('invoices').update(invoiceData).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabase.from('invoices').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
  if (error) return res.status(400).json({ error: error.message })
  return res.json({ message: 'Invoice deleted' })
})

// PDF - returns HTML that can be printed to PDF
router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  const { data: invoice } = await supabase.from('invoices').select('*, clients(*), invoice_items(*), profiles(*)').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  try {
    const pdfBuffer = await pdfService.generateInvoicePDF(invoice)
    // Check if it's HTML (puppeteer not available) or PDF
    const isHtml = pdfBuffer.toString('utf-8', 0, 15).includes('<!DOCTYPE')
    if (isHtml) {
      res.setHeader('Content-Type', 'text/html')
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.html"`)
    } else {
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`)
    }
    return res.send(pdfBuffer)
  } catch(e: any) {
    // Fallback - return HTML
    const html = pdfService.generateHTMLOnly(invoice)
    res.setHeader('Content-Type', 'text/html')
    return res.send(html)
  }
})

router.post('/:id/send', async (req: AuthRequest, res: Response) => {
  const { data: invoice } = await supabase.from('invoices').select('*, clients(*), invoice_items(*), profiles(*)').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  let paymentLink = invoice.stripe_payment_link
  if (!paymentLink) {
    try { paymentLink = await stripeService.createPaymentLink(invoice); await supabase.from('invoices').update({ stripe_payment_link: paymentLink }).eq('id', invoice.id) } catch(e) {}
  }
  // Send email with HTML invoice (no PDF attachment needed)
  const pdfBuffer = Buffer.from(pdfService.generateHTMLOnly(invoice), 'utf-8')
  await emailService.sendInvoice({ to: invoice.clients.email, clientName: invoice.clients.name, invoice: { ...invoice, stripe_payment_link: paymentLink }, pdfBuffer })
  await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice.id)
  return res.json({ message: 'Invoice sent', payment_link: paymentLink })
})

router.post('/:id/mark-paid', async (req: AuthRequest, res: Response) => {
  const { amount, method = 'manual', reference, notes } = req.body
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  const paymentAmount = amount || invoice.total
  await supabase.from('payments').insert({ user_id: req.user!.id, invoice_id: invoice.id, amount: paymentAmount, currency: invoice.currency, method, reference, notes, status: 'completed' })
  await supabase.from('invoices').update({ status: 'paid', amount_paid: paymentAmount, paid_at: new Date().toISOString() }).eq('id', invoice.id)
  return res.json({ message: 'Invoice marked as paid' })
})

router.post('/:id/payment-link', async (req: AuthRequest, res: Response) => {
  const { data: invoice } = await supabase.from('invoices').select('*, clients(*)').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  const paymentLink = await stripeService.createPaymentLink(invoice)
  await supabase.from('invoices').update({ stripe_payment_link: paymentLink }).eq('id', invoice.id)
  return res.json({ payment_link: paymentLink })
})

export default router
