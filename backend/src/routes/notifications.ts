import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'

const router = Router()
router.use(authenticate)

// Send WhatsApp message via Twilio
async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

    if (!accountSid || !authToken) {
      console.log('Twilio not configured — WhatsApp message would send to:', to)
      console.log('Message:', message)
      return true // Return true in dev mode
    }

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: message })
    })
    return res.ok
  } catch (err) {
    console.error('WhatsApp error:', err)
    return false
  }
}

async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_SMS_FROM

    if (!accountSid || !authToken || !from) {
      console.log('Twilio SMS not configured — SMS would send to:', to)
      return true
    }

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ From: from, To: to, Body: message })
    })
    return res.ok
  } catch (err) {
    console.error('SMS error:', err)
    return false
  }
}

// Send WhatsApp reminder for an invoice
router.post('/whatsapp/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice } = await supabase.from('invoices')
      .select(`*, clients(*), profiles(company_name, full_name)`)
      .eq('id', req.params.invoiceId).eq('user_id', req.user!.id).single()

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (!invoice.clients?.phone) return res.status(400).json({ error: 'Client has no phone number. Add a phone number to this client first.' })

    const companyName = invoice.profiles?.company_name || invoice.profiles?.full_name || 'Your vendor'
    const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
    const currency = sym[invoice.currency] || invoice.currency
    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const isOverdue = new Date(invoice.due_date) < new Date()

    const message = isOverdue
      ? `Hi ${invoice.clients.name},\n\nThis is a friendly reminder from ${companyName} that invoice ${invoice.invoice_number} for ${currency}${invoice.total.toFixed(2)} is now overdue (was due ${dueDate}).\n\nPlease pay at your earliest convenience:\n${invoice.stripe_payment_link || 'Contact us to arrange payment'}\n\nThank you!`
      : `Hi ${invoice.clients.name},\n\nInvoice ${invoice.invoice_number} for ${currency}${invoice.total.toFixed(2)} from ${companyName} is due on ${dueDate}.\n\nPay securely online:\n${invoice.stripe_payment_link || 'Contact us for payment details'}\n\nThank you!`

    const success = await sendWhatsApp(invoice.clients.phone, message)
    if (!success) return res.status(500).json({ error: 'Failed to send WhatsApp message' })

    // Log reminder
    await supabase.from('reminder_logs').insert({
      invoice_id: invoice.id, type: 'whatsapp',
      email_to: invoice.clients.phone, success: true
    })

    return res.json({ message: `WhatsApp sent to ${invoice.clients.name} (${invoice.clients.phone})` })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to send WhatsApp' })
  }
})

// Send SMS reminder
router.post('/sms/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice } = await supabase.from('invoices')
      .select(`*, clients(*), profiles(company_name, full_name)`)
      .eq('id', req.params.invoiceId).eq('user_id', req.user!.id).single()

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (!invoice.clients?.phone) return res.status(400).json({ error: 'Client has no phone number' })

    const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
    const currency = sym[invoice.currency] || invoice.currency
    const message = `Invoice ${invoice.invoice_number} for ${currency}${invoice.total.toFixed(2)} is due. Pay here: ${invoice.stripe_payment_link || 'Contact us'}`

    const success = await sendSMS(invoice.clients.phone, message)
    if (!success) return res.status(500).json({ error: 'Failed to send SMS' })

    await supabase.from('reminder_logs').insert({
      invoice_id: invoice.id, type: 'sms',
      email_to: invoice.clients.phone, success: true
    })

    return res.json({ message: `SMS sent to ${invoice.clients.phone}` })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send SMS' })
  }
})

// Bulk send WhatsApp to all overdue invoices
router.post('/whatsapp-bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { data: overdue } = await supabase.from('invoices')
      .select(`*, clients(*), profiles(company_name, full_name)`)
      .eq('user_id', req.user!.id)
      .in('status', ['overdue', 'sent', 'pending'])
      .lt('due_date', new Date().toISOString().split('T')[0])

    if (!overdue?.length) return res.json({ message: 'No overdue invoices found', sent: 0 })

    let sent = 0
    for (const invoice of overdue) {
      if (!invoice.clients?.phone) continue
      const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
      const currency = sym[invoice.currency] || invoice.currency
      const companyName = invoice.profiles?.company_name || invoice.profiles?.full_name || 'Your vendor'
      const message = `Hi ${invoice.clients.name}, invoice ${invoice.invoice_number} for ${currency}${invoice.total.toFixed(2)} from ${companyName} is overdue. Please pay: ${invoice.stripe_payment_link || 'Contact us'}`
      const success = await sendWhatsApp(invoice.clients.phone, message)
      if (success) {
        sent++
        await supabase.from('reminder_logs').insert({ invoice_id: invoice.id, type: 'whatsapp', email_to: invoice.clients.phone, success: true })
      }
    }

    return res.json({ message: `WhatsApp sent to ${sent} clients`, sent, total: overdue.length })
  } catch (err) {
    return res.status(500).json({ error: 'Bulk WhatsApp failed' })
  }
})

export default router
