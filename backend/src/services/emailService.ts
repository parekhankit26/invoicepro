import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

// ── Get email config from DB (admin settings) ─────────────
// This is the ONLY source of truth for email config
// Admin controls everything from the Super Admin panel
export async function getEmailConfig() {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data } = await supabase.from('app_settings')
      .select('key, value')
      .in('key', ['email_provider','resend_api_key','resend_from','resend_name',
        'smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','smtp_secure'])
    
    if (!data || data.length === 0) throw new Error('no_config')
    
    const cfg: any = {}
    data.forEach((r: any) => { 
      try { cfg[r.key] = JSON.parse(r.value) } 
      catch { cfg[r.key] = r.value } 
    })
    
    // DB config loaded — resolve provider, fall back to env vars before 'none'
    if (!cfg.resend_api_key && process.env.RESEND_API_KEY) {
      cfg.resend_api_key = process.env.RESEND_API_KEY
      cfg.resend_from = cfg.resend_from || process.env.RESEND_FROM || 'noreply@invoicepro.app'
      cfg.resend_name = cfg.resend_name || process.env.RESEND_NAME || 'InvoicePro'
    }
    const provider = cfg.email_provider || (cfg.resend_api_key ? 'resend' : cfg.smtp_host ? 'smtp' : 'none')
    return { provider, cfg }
  } catch(e) {
    // Fall back to env vars — check Resend first (works on Railway), then SMTP
    if (process.env.RESEND_API_KEY) {
      return {
        provider: 'resend',
        cfg: {
          resend_api_key: process.env.RESEND_API_KEY,
          resend_from: process.env.RESEND_FROM || 'noreply@invoicepro.app',
          resend_name: process.env.RESEND_NAME || 'InvoicePro',
        }
      }
    }
    return {
      provider: process.env.SMTP_HOST ? 'smtp' : 'none',
      cfg: {
        smtp_host: process.env.SMTP_HOST || '',
        smtp_port: process.env.SMTP_PORT || '587',
        smtp_user: process.env.SMTP_USER || '',
        smtp_pass: process.env.SMTP_PASS || '',
        smtp_from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
        smtp_secure: process.env.SMTP_PORT === '465',
      }
    }
  }
}

async function sendEmail(to: string, subject: string, html: string, attachments?: any[]) {
  const { provider, cfg } = await getEmailConfig()
  
  if (provider === 'none') {
    throw new Error('Email not configured. Set up email in Super Admin → Email settings.')
  }
  
  if (provider === 'resend') {
    if (!cfg.resend_api_key) throw new Error('Resend API key not configured.')
    const { Resend } = await import('resend')
    const resend = new Resend(cfg.resend_api_key)
    const fromStr = cfg.resend_name 
      ? `${cfg.resend_name} <${cfg.resend_from}>` 
      : cfg.resend_from
    const result = await resend.emails.send({ from: fromStr, to: [to], subject, html, attachments })
    if (result.error) throw new Error(result.error.message)
    return result
  }
  
  // SMTP
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
    throw new Error('SMTP not fully configured. Go to Super Admin → Email settings.')
  }
  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: parseInt(cfg.smtp_port || '587'),
    secure: cfg.smtp_secure === true || cfg.smtp_secure === 'true' || cfg.smtp_port === '465',
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    tls: { rejectUnauthorized: false }
  })
  const fromStr = cfg.smtp_from || cfg.smtp_user
  await transporter.sendMail({ from: fromStr, to, subject, html, attachments })
}

// Currency code → symbol helper (covers all 60+ currencies in the system)
const sym = (currency: string): string => {
  const map: Record<string, string> = {
    GBP:'£', USD:'$', EUR:'€', INR:'₹', CAD:'C$', AUD:'A$', NZD:'NZ$', SGD:'S$',
    CHF:'Fr', JPY:'¥', CNY:'¥', HKD:'HK$', KRW:'₩', MYR:'RM', THB:'฿', IDR:'Rp',
    PHP:'₱', VND:'₫', BDT:'৳', PKR:'₨', LKR:'Rs', NPR:'Rs', AED:'د.إ', SAR:'﷼',
    QAR:'QR', KWD:'KD', BHD:'BD', OMR:'OMR', ILS:'₪', TRY:'₺', EGP:'E£', ZAR:'R',
    NGN:'₦', KES:'KSh', GHS:'₵', MAD:'MAD', SEK:'kr', NOK:'kr', DKK:'kr', PLN:'zł',
    CZK:'Kč', HUF:'Ft', RON:'lei', BGN:'лв', RUB:'₽', UAH:'₴', MXN:'$', BRL:'R$',
    ARS:'$', CLP:'$', COP:'$', PEN:'S/.',
  }
  return map[currency] || (currency + ' ')
}
const fmtAmt = (amount: number, currency: string): string => {
  const noDecimals = ['JPY','KRW','VND','IDR','HUF','CLP']
  const decimals = noDecimals.includes(currency) ? 0 : 2
  return `${sym(currency)}${amount.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

const base = (content: string, accentColor = '#0f172a') => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  .hdr{background:${accentColor};padding:28px 32px;color:#fff}
  .hdr h1{margin:0;font-size:22px;font-weight:600;letter-spacing:-0.5px}
  .hdr p{margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px}
  .body{padding:32px}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0}
  .row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#374151;border-bottom:1px solid #f1f5f9}
  .row:last-child{border:none}
  .total{font-weight:700;font-size:16px;border-top:1px solid #e2e8f0;margin-top:8px;padding-top:10px;display:flex;justify-content:space-between}
  .btn{display:inline-block;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0;text-align:center}
  .btn-primary{background:${accentColor};color:#fff}
  .btn-success{background:#16a34a;color:#fff}
  .btn-danger{background:#dc2626;color:#fff}
  .footer{background:#f8fafc;padding:20px 32px;font-size:12px;color:#9ca3af;border-top:1px solid #e2e8f0}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
  .badge-pending{background:#fef3c7;color:#b45309}
  .badge-accepted{background:#dcfce7;color:#15803d}
</style></head><body><div class="wrap">${content}</div></body></html>`

export const emailService = {
  async sendInvoice({ to, clientName, invoice, pdfBuffer }: { to: string; clientName: string; invoice: any; pdfBuffer: Buffer }) {
    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const html = base(`
      <div class="hdr"><h1>Invoice ${invoice.invoice_number}</h1><p>From ${invoice.profiles?.company_name || invoice.profiles?.full_name || 'Your Vendor'}</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Dear ${clientName},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">Please find attached your invoice. You can pay securely online using the button below.</p>
        <div class="box">
          <div class="row"><span>Invoice number</span><strong>${invoice.invoice_number}</strong></div>
          <div class="row"><span>Due date</span><strong>${dueDate}</strong></div>
          <div class="row"><span>Currency</span><strong>${invoice.currency || 'GBP'}</strong></div>
          <div class="total"><span>Total due</span><span>${fmtAmt(invoice.total, invoice.currency || 'GBP')}</span></div>
        </div>
        ${invoice.stripe_payment_link ? `<a href="${invoice.stripe_payment_link}" class="btn btn-primary" style="background:#0f172a;color:#fff">Pay Now — ${fmtAmt(invoice.total, invoice.currency || 'GBP')}</a>` : ''}
      </div>
      <div class="footer">This invoice was sent via InvoicePro. Please do not reply to this email.</div>`)
    await sendEmail(to, `Invoice ${invoice.invoice_number} — ${fmtAmt(invoice.total, invoice.currency || 'GBP')} due ${dueDate}`, html, [
      { filename: `${invoice.invoice_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }
    ])
  },

  async sendQuote({ to, clientName, quote, portalUrl }: { to: string; clientName: string; quote: any; portalUrl: string }) {
    const expiryDate = quote.expiry_date ? new Date(quote.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No expiry'
    const html = base(`
      <div class="hdr" style="background:#0369a1"><h1>Quote ${quote.quote_number}</h1><p>Review and respond below</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Dear ${clientName},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">Please review the quote below and let us know if you'd like to proceed.</p>
        <div class="box">
          <div class="row"><span>Quote number</span><strong>${quote.quote_number}</strong></div>
          <div class="row"><span>Valid until</span><strong>${expiryDate}</strong></div>
          <div class="total"><span>Total</span><span>${fmtAmt(quote.total, quote.currency || 'GBP')}</span></div>
        </div>
        <a href="${portalUrl}?action=accept" class="btn btn-success" style="margin-right:12px">✓ Accept Quote</a>
        <a href="${portalUrl}?action=decline" class="btn btn-danger">✗ Decline</a>
        <p style="color:#9ca3af;font-size:13px;margin-top:16px">Or view online: <a href="${portalUrl}" style="color:#0369a1">${portalUrl}</a></p>
      </div>
      <div class="footer">This quote was sent via InvoicePro.</div>`)
    await sendEmail(to, `Quote ${quote.quote_number} — ${fmtAmt(quote.total, quote.currency || 'GBP')} — Please review`, html)
  },

  async sendPaymentReminder({ to, clientName, invoice }: { to: string; clientName: string; invoice: any }) {
    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const isOverdue = new Date(invoice.due_date) < new Date()
    const html = base(`
      <div class="hdr" style="background:${isOverdue ? '#dc2626' : '#d97706'}">
        <h1>${isOverdue ? '⚠ Overdue Invoice' : '⏰ Payment Reminder'}</h1>
        <p>Invoice ${invoice.invoice_number}</p>
      </div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Dear ${clientName},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">
          ${isOverdue ? 'This invoice is now overdue. Please arrange payment as soon as possible.' : 'This is a friendly reminder that payment is due soon.'}
        </p>
        <div class="box">
          <div class="row"><span>Invoice</span><strong>${invoice.invoice_number}</strong></div>
          <div class="row"><span>Due date</span><strong>${dueDate}</strong></div>
          <div class="total"><span>Amount due</span><span>${fmtAmt(invoice.total, invoice.currency || 'GBP')}</span></div>
        </div>
        ${invoice.stripe_payment_link ? `<a href="${invoice.stripe_payment_link}" class="btn btn-primary" style="background:#dc2626">Pay Now</a>` : ''}
      </div>
      <div class="footer">InvoicePro payment reminder.</div>`)
    await sendEmail(to, `${isOverdue ? '[OVERDUE] ' : ''}Payment reminder — Invoice ${invoice.invoice_number}`, html)
  },

  async sendGeneral({ to, subject, html }: { to: string; subject: string; html: string }) {
    await sendEmail(to, subject, html)
  },
  async sendSatisfactionSurvey({ to, clientName, invoiceNumber, surveyUrl }: any) {
    await sendEmail(to, `How did we do? — Invoice ${invoiceNumber}`,
      base(`<div class="hdr" style="background:#0369a1"><h1>Quick feedback</h1></div><div class="body"><p>Dear ${clientName},</p><p style="color:#6b7280">Rate your experience — takes 30 seconds.</p><a href="${surveyUrl}" class="btn btn-primary" style="background:#0369a1">Rate now</a></div><div class="footer">InvoicePro.</div>`))
  },
  async sendTeamInvite({ to, inviterName, companyName, acceptUrl }: any) {
    await sendEmail(to, `Invitation to join ${companyName} on InvoicePro`,
      base(`<div class="hdr"><h1>Team invitation</h1></div><div class="body"><p>Dear team member,</p><p style="color:#6b7280">${inviterName} has invited you to join <strong>${companyName}</strong> on InvoicePro.</p><a href="${acceptUrl}" class="btn btn-primary" style="background:#0f172a">Accept invitation</a></div><div class="footer">InvoicePro.</div>`))
  },
  async sendPaymentConfirmation({ to, clientName, invoice }: any) {
    await sendEmail(to, `Payment received — Invoice ${invoice.invoice_number}`,
      base(`<div class="hdr" style="background:#16a34a"><h1>Payment received</h1></div><div class="body"><p>Dear ${clientName},</p><p style="color:#6b7280">Thank you! Payment for invoice ${invoice.invoice_number} has been received.</p><div class="box"><div class="total"><span>Amount</span><span>${fmtAmt(invoice.total, invoice.currency||'GBP')}</span></div></div></div><div class="footer">InvoicePro.</div>`))
  },
  async sendOverdueReminder({ to, clientName, invoice }: any) {
    const days = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000)
    await sendEmail(to, `[OVERDUE ${days}d] Invoice ${invoice.invoice_number} — ${fmtAmt(invoice.total, invoice.currency||'GBP')}`,
      base(`<div class="hdr" style="background:#dc2626"><h1>Invoice overdue</h1></div><div class="body"><p>Dear ${clientName},</p><p style="color:#6b7280">Invoice ${invoice.invoice_number} for ${fmtAmt(invoice.total, invoice.currency||'GBP')} is ${days} days overdue. Please arrange payment.</p>${invoice.stripe_payment_link?`<a href="${invoice.stripe_payment_link}" class="btn btn-danger">Pay now</a>`:''}</div><div class="footer">InvoicePro.</div>`))
  },
  async sendUpcomingReminder({ to, clientName, invoice }: any) {
    await sendEmail(to, `Payment due soon — Invoice ${invoice.invoice_number}`,
      base(`<div class="hdr" style="background:#d97706"><h1>Payment due soon</h1></div><div class="body"><p>Dear ${clientName},</p><p style="color:#6b7280">Invoice ${invoice.invoice_number} is due soon.</p>${invoice.stripe_payment_link?`<a href="${invoice.stripe_payment_link}" class="btn btn-primary" style="background:#d97706">Pay now</a>`:''}</div><div class="footer">InvoicePro.</div>`))
  },

  async sendFinancingApplicationReceived({ to, name, reference, invoiceNumber, netAdvance, currency }: any) {
    if (!to) return
    const s = (c: string) => ({GBP:'£',USD:'$',EUR:'€',INR:'₹',CAD:'C$',AUD:'A$'}[c] || c + ' ')
    const amt = `${s(currency)}${netAdvance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    await sendEmail(to, `Financing application received — Ref: ${reference}`,
      base(`
        <div class="hdr" style="background:#0369a1"><h1>Application received</h1><p>Ref: ${reference}</p></div>
        <div class="body">
          <p>Hi ${name},</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.6">We've received your invoice financing application and our team will review it within 2 business hours.</p>
          <div class="box">
            <div class="row"><span>Reference</span><strong>${reference}</strong></div>
            <div class="row"><span>Invoice</span><strong>${invoiceNumber}</strong></div>
            <div class="total"><span>Net advance requested</span><span>${amt}</span></div>
          </div>
          <p style="color:#6b7280;font-size:13px">You'll receive an email as soon as your application is reviewed. No action needed from you right now.</p>
        </div>
        <div class="footer">InvoicePro Financing · Questions? Reply to this email.</div>`))
  },

  async sendFinancingStatusUpdate({ to, name, status, reference, invoiceNumber, netAdvance, currency, rejectionReason, adminNotes }: any) {
    if (!to) return
    const s = (c: string) => ({GBP:'£',USD:'$',EUR:'€',INR:'₹',CAD:'C$',AUD:'A$'}[c] || c + ' ')
    const amt = `${s(currency)}${netAdvance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const configs: Record<string, any> = {
      under_review: { color: '#0369a1', title: 'Under review', body: 'Your application is now being reviewed by our financing team. You\'ll hear back very shortly.' },
      approved: { color: '#16a34a', title: 'Application approved!', body: `Great news! Your financing application has been approved. We will transfer ${amt} to your bank account within 24 hours.` },
      funded: { color: '#16a34a', title: 'Funds sent!', body: `${amt} has been transferred to your bank account. Please allow 1-2 hours for the funds to appear. We will collect the invoice amount from your client on the due date.` },
      repaid: { color: '#374151', title: 'Financing complete', body: 'Your client has paid the invoice and the financing arrangement is now complete. Thank you for using InvoicePro Financing.' },
      rejected: { color: '#dc2626', title: 'Application update', body: rejectionReason ? `We were unable to approve your financing application. Reason: ${rejectionReason}` : 'We were unable to approve your financing application at this time. Please contact us for more information.' },
    }
    const cfg = configs[status]
    if (!cfg) return

    await sendEmail(to, `Financing ${status.replace('_', ' ')} — Ref: ${reference}`,
      base(`
        <div class="hdr" style="background:${cfg.color}"><h1>${cfg.title}</h1><p>Ref: ${reference} · Invoice ${invoiceNumber}</p></div>
        <div class="body">
          <p>Hi ${name},</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.6">${cfg.body}</p>
          ${adminNotes && status !== 'rejected' ? `<div class="box"><p style="margin:0;font-size:13px;color:#374151"><strong>Note from our team:</strong> ${adminNotes}</p></div>` : ''}
        </div>
        <div class="footer">InvoicePro Financing · Ref: ${reference}</div>`))
  },

}
