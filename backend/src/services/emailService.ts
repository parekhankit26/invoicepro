import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
})

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
  // ── INVOICE EMAIL ──────────────────────────────────────
  async sendInvoice({ to, clientName, invoice, pdfBuffer }: { to: string; clientName: string; invoice: any; pdfBuffer: Buffer }) {
    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const html = base(`
      <div class="hdr"><h1>Invoice ${invoice.invoice_number}</h1><p>From ${invoice.profiles?.company_name || invoice.profiles?.full_name || 'Your Vendor'}</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Hi ${clientName},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">Please find attached your invoice. You can pay securely online using the button below.</p>
        <div class="box">
          <div class="row"><span>Invoice</span><span><strong>${invoice.invoice_number}</strong></span></div>
          <div class="row"><span>Due date</span><span>${dueDate}</span></div>
          ${invoice.tax_amount > 0 ? `<div class="row"><span>Subtotal</span><span>${invoice.currency} ${invoice.subtotal?.toFixed(2)}</span></div><div class="row"><span>VAT (${invoice.tax_rate}%)</span><span>${invoice.currency} ${invoice.tax_amount?.toFixed(2)}</span></div>` : ''}
          ${invoice.late_fee_amount > 0 ? `<div class="row"><span style="color:#dc2626">Late fee</span><span style="color:#dc2626">${invoice.currency} ${invoice.late_fee_amount?.toFixed(2)}</span></div>` : ''}
          <div class="total"><span>Total due</span><span>${invoice.currency} ${invoice.total?.toFixed(2)}</span></div>
        </div>
        ${invoice.stripe_payment_link ? `<div style="text-align:center"><a href="${invoice.stripe_payment_link}" class="btn btn-primary">Pay Now — ${invoice.currency} ${invoice.total?.toFixed(2)}</a></div>` : ''}
        ${invoice.notes ? `<p style="color:#6b7280;font-size:13px"><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
      </div>
      <div class="footer"><p>Invoice attached as PDF. Reply to this email with any questions.</p></div>`)
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject: `Invoice ${invoice.invoice_number} — ${invoice.currency} ${invoice.total?.toFixed(2)} due ${dueDate}`, html, attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] })
  },

  // ── QUOTE EMAIL ────────────────────────────────────────
  async sendQuote({ to, clientName, quote, portalUrl }: { to: string; clientName: string; quote: any; portalUrl: string }) {
    const expiryDate = new Date(quote.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const html = base(`
      <div class="hdr" style="background:#1e40af"><h1>Quote ${quote.quote_number}</h1><p>From ${quote.profiles?.company_name || quote.profiles?.full_name}</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Hi ${clientName},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">Please review the quote below. You can accept or decline it online using the button below.</p>
        <div class="box">
          <div class="row"><span>Quote number</span><span><strong>${quote.quote_number}</strong></span></div>
          <div class="row"><span>Valid until</span><span>${expiryDate}</span></div>
          ${quote.tax_amount > 0 ? `<div class="row"><span>Subtotal</span><span>${quote.currency} ${quote.subtotal?.toFixed(2)}</span></div><div class="row"><span>VAT (${quote.tax_rate}%)</span><span>${quote.currency} ${quote.tax_amount?.toFixed(2)}</span></div>` : ''}
          <div class="total"><span>Total</span><span>${quote.currency} ${quote.total?.toFixed(2)}</span></div>
        </div>
        <div style="text-align:center;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a href="${portalUrl}?action=accept" class="btn btn-success">Accept Quote</a>
          <a href="${portalUrl}?action=decline" class="btn btn-danger">Decline</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:8px">Or <a href="${portalUrl}">view full quote online</a></p>
        ${quote.notes ? `<p style="color:#6b7280;font-size:13px;margin-top:16px"><strong>Notes:</strong> ${quote.notes}</p>` : ''}
      </div>
      <div class="footer"><p>This quote expires on ${expiryDate}. Reply to this email with any questions.</p></div>`, '#1e40af')
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject: `Quote ${quote.quote_number} — ${quote.currency} ${quote.total?.toFixed(2)} — Action required`, html })
  },

  // ── PAYMENT CONFIRMATION ───────────────────────────────
  async sendPaymentConfirmation({ invoice, client }: { invoice: any; client: any }) {
    const html = base(`
      <div class="hdr" style="background:#15803d"><h1>Payment received</h1><p>Thank you!</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Hi ${client.name},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">We've received your payment for invoice <strong>${invoice.invoice_number}</strong>.</p>
        <div class="box">
          <div class="row"><span>Invoice</span><span>${invoice.invoice_number}</span></div>
          <div class="row"><span>Amount paid</span><span><strong>${invoice.currency} ${invoice.total?.toFixed(2)}</strong></span></div>
          <div class="row"><span>Date</span><span>${new Date().toLocaleDateString('en-GB')}</span></div>
          <div class="row"><span>Status</span><span><span class="badge badge-accepted">Paid</span></span></div>
        </div>
        <p style="color:#6b7280;font-size:13px">Please keep this email as your payment confirmation.</p>
      </div>
      <div class="footer"><p>Thank you for your business!</p></div>`, '#15803d')
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to: client.email, subject: `Payment confirmed — Invoice ${invoice.invoice_number}`, html })
  },

  // ── OVERDUE REMINDER ───────────────────────────────────
  async sendOverdueReminder({ invoice, client, daysOverdue }: { invoice: any; client: any; daysOverdue: number }) {
    const html = base(`
      <div class="hdr" style="background:#7f1d1d"><h1>Payment overdue</h1><p>Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Hi ${client.name},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">Invoice <strong>${invoice.invoice_number}</strong> was due on <strong>${new Date(invoice.due_date).toLocaleDateString('en-GB')}</strong> and is now <strong>${daysOverdue} days overdue</strong>.</p>
        <div class="box">
          <div class="row"><span>Invoice</span><span>${invoice.invoice_number}</span></div>
          <div class="row"><span>Due date</span><span>${new Date(invoice.due_date).toLocaleDateString('en-GB')}</span></div>
          <div class="total"><span>Amount due</span><span>${invoice.currency} ${invoice.total?.toFixed(2)}</span></div>
        </div>
        ${invoice.stripe_payment_link ? `<div style="text-align:center"><a href="${invoice.stripe_payment_link}" class="btn btn-primary" style="background:#dc2626">Pay Now</a></div>` : ''}
      </div>
      <div class="footer"><p>If you have already sent payment, please disregard this notice.</p></div>`, '#7f1d1d')
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to: client.email, subject: `Overdue: Invoice ${invoice.invoice_number} — ${daysOverdue} days past due`, html })
  },

  // ── UPCOMING REMINDER ──────────────────────────────────
  async sendUpcomingReminder({ invoice, client, daysUntilDue }: { invoice: any; client: any; daysUntilDue: number }) {
    const html = base(`
      <div class="hdr" style="background:#78350f"><h1>Payment due soon</h1><p>Due in ${daysUntilDue} days</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Hi ${client.name},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">Friendly reminder: invoice <strong>${invoice.invoice_number}</strong> is due in <strong>${daysUntilDue} days</strong> on <strong>${new Date(invoice.due_date).toLocaleDateString('en-GB')}</strong>.</p>
        <div class="box"><div class="total"><span>Amount due</span><span>${invoice.currency} ${invoice.total?.toFixed(2)}</span></div></div>
        ${invoice.stripe_payment_link ? `<div style="text-align:center"><a href="${invoice.stripe_payment_link}" class="btn btn-primary">Pay Now</a></div>` : ''}
      </div>
      <div class="footer"><p>Thank you for your prompt attention.</p></div>`, '#78350f')
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to: client.email, subject: `Reminder: Invoice ${invoice.invoice_number} due in ${daysUntilDue} days`, html })
  },

  // ── TEAM INVITE ────────────────────────────────────────
  async sendTeamInvite({ to, inviteeName, inviteUrl, role }: { to: string; inviteeName: string; inviteUrl: string; role: string }) {
    const html = base(`
      <div class="hdr" style="background:#4338ca"><h1>You're invited to join the team</h1><p>As ${role}</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Hi ${inviteeName},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">You've been invited to join as a <strong>${role}</strong> on InvoicePro. Click the button below to accept your invitation.</p>
        <div style="text-align:center"><a href="${inviteUrl}" class="btn btn-primary" style="background:#4338ca">Accept Invitation</a></div>
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:8px">This invite expires in 7 days.</p>
      </div>
      <div class="footer"><p>If you didn't expect this invite, you can safely ignore this email.</p></div>`, '#4338ca')
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject: `You've been invited to InvoicePro as ${role}`, html })
  },

  async sendSatisfactionSurvey({ to, clientName, companyName, surveyUrl, invoice }: { to: string; clientName: string; companyName: string; surveyUrl: string; invoice: any }) {
    const html = base(`
      <div class="hdr" style="background:#0f766e"><h1>How did we do?</h1><p>Quick feedback</p></div>
      <div class="body">
        <p style="color:#374151;font-size:15px">Hi ${clientName},</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6">Thank you for paying invoice <strong>${invoice.invoice_number}</strong>. We'd love to hear how your experience was with <strong>${companyName}</strong>.</p>
        <div style="text-align:center;margin:24px 0">
          <p style="color:#374151;font-weight:600;margin-bottom:16px">How would you rate your experience? (click one)</p>
          <a href="${surveyUrl}?score=5" class="btn btn-primary" style="background:#16a34a">Excellent ★★★★★</a><br><br>
          <a href="${surveyUrl}?score=4" class="btn btn-secondary" style="display:inline-block;padding:10px 20px;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;font-size:13px;color:#374151;margin:4px">Good ★★★★</a>
          <a href="${surveyUrl}?score=3" class="btn btn-secondary" style="display:inline-block;padding:10px 20px;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;font-size:13px;color:#374151;margin:4px">Average ★★★</a>
          <a href="${surveyUrl}?score=2" class="btn btn-secondary" style="display:inline-block;padding:10px 20px;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;font-size:13px;color:#374151;margin:4px">Poor ★★</a>
          <a href="${surveyUrl}?score=1" class="btn btn-danger" style="display:inline-block;padding:10px 20px;border:1px solid #fecaca;border-radius:8px;text-decoration:none;font-size:13px;color:#dc2626;margin:4px">Terrible ★</a>
        </div>
      </div>
      <div class="footer"><p>Your feedback helps us improve. Thank you!</p></div>`, '#0f766e')
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject: `How did we do? — Quick feedback for ${companyName}`, html })
  }
}