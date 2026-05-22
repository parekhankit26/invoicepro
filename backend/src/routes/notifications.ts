import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import crypto from 'crypto'

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

// Normalise phone → digits only, no leading +
function toWaPhone(raw: string) {
  return raw.replace(/[^\d]/g, '')
}

// Build a wa.me deep-link that opens WhatsApp with a pre-filled message
function waLink(phone: string, message: string) {
  return `https://wa.me/${toWaPhone(phone)}?text=${encodeURIComponent(message)}`
}

// WhatsApp invoice notification (wa.me deep link — no Twilio required)
router.post('/whatsapp/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice, error: invWaErr } = await supabase.from('invoices')
      .select(`*, clients(*)`)
      .eq('id', (req as any).params.invoiceId).eq('user_id', (req as any).user!.id).single()

    if (invWaErr || !invoice) {
      console.error('WhatsApp invoice lookup error:', invWaErr?.message)
      return res.status(404).json({ error: 'Invoice not found' })
    }
    if (!invoice.clients?.phone) return res.status(400).json({ error: 'Client has no phone number. Add a phone number to this client first.' })
    const { data: waProfile } = await supabase.from('profiles').select('company_name, full_name').eq('id', (req as any).user!.id).single()
    const companyName = waProfile?.company_name || waProfile?.full_name || 'Your vendor'
    const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
    const currency = sym[invoice.currency] || invoice.currency
    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const isOverdue = new Date(invoice.due_date) < new Date()

    const message = isOverdue
      ? `Hi ${invoice.clients.name},\n\nFriendly reminder from ${companyName} — invoice ${invoice.invoice_number} for ${currency}${invoice.total.toFixed(2)} is now overdue (was due ${dueDate}).\n\nPlease pay at your earliest convenience:\n${invoice.stripe_payment_link || 'Contact us to arrange payment'}\n\nThank you!`
      : `Hi ${invoice.clients.name},\n\nInvoice ${invoice.invoice_number} for ${currency}${invoice.total.toFixed(2)} from ${companyName} is due on ${dueDate}.\n\nPay securely online:\n${invoice.stripe_payment_link || 'Contact us for payment details'}\n\nThank you!`

    const wa_url = waLink(invoice.clients.phone, message)

    try {
      await supabase.from('reminder_logs').insert({
        invoice_id: invoice.id, type: 'whatsapp',
        email_to: invoice.clients.phone, success: true
      })
    } catch (_) {}

    return res.json({ wa_url, client_name: invoice.clients.name })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to generate WhatsApp link' })
  }
})

// WhatsApp quote notification (wa.me deep link)
router.post('/whatsapp-quote/:quoteId', async (req: AuthRequest, res: Response) => {
  try {
    const { data: quote, error: quoteErr } = await supabase.from('quotes')
      .select(`*, clients(*)`)
      .eq('id', (req as any).params.quoteId).eq('user_id', (req as any).user!.id).single()

    if (quoteErr || !quote) {
      console.error('WhatsApp quote lookup error:', quoteErr?.message)
      return res.status(404).json({ error: 'Quote not found' })
    }
    // Fetch profile separately to avoid cross-schema join issues
    const { data: profileData } = await supabase.from('profiles').select('company_name, full_name').eq('id', (req as any).user!.id).single()
    ;(quote as any).profiles = profileData
    if (!quote.clients?.phone) return res.status(400).json({ error: 'Client has no phone number. Add a phone number to this client first.' })

    const companyName = quote.profiles?.company_name || quote.profiles?.full_name || 'Your vendor'
    const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
    const currency = sym[quote.currency] || quote.currency
    const expiry = quote.expiry_date
      ? new Date(quote.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'no expiry'

    // Look up or auto-generate portal token for this client
    const frontendUrl = process.env.FRONTEND_URL || 'https://invoicepro-ten.vercel.app'
    let portalUrl = `${frontendUrl}/quotes`
    const { data: portalData } = await supabase.from('client_portal_tokens')
      .select('token').eq('client_id', quote.client_id).eq('user_id', (req as any).user!.id).single()
    if (portalData?.token) {
      portalUrl = `${frontendUrl}/portal/${portalData.token}`
    } else {
      const token = crypto.randomBytes(48).toString('base64url')
      const { data: newPortal } = await supabase.from('client_portal_tokens')
        .upsert({ user_id: (req as any).user!.id, client_id: quote.client_id, token, is_active: true }, { onConflict: 'user_id,client_id' })
        .select('token').single()
      if (newPortal?.token) portalUrl = `${frontendUrl}/portal/${newPortal.token}`
    }

    const message = `Hi ${quote.clients.name},\n\nYou have a quote from ${companyName}!\n\nQuote ${quote.quote_number} for ${currency}${quote.total.toFixed(2)} — valid until ${expiry}.\n\nReview and accept it here:\n${portalUrl}\n\nThank you!`

    const wa_url = waLink(quote.clients.phone, message)
    return res.json({ wa_url, client_name: quote.clients.name })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate WhatsApp link' })
  }
})

// Send SMS reminder
router.post('/sms/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice, error: smsInvErr } = await supabase.from('invoices')
      .select(`*, clients(*)`)
      .eq('id', (req as any).params.invoiceId).eq('user_id', (req as any).user!.id).single()

    if (smsInvErr || !invoice) {
      console.error('SMS invoice lookup error:', smsInvErr?.message)
      return res.status(404).json({ error: 'Invoice not found' })
    }
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
      .eq('user_id', (req as any).user!.id)
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
