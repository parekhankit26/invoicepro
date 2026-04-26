// PDF Service - generates invoice HTML
// On Railway: returns HTML for browser printing
// Locally: uses puppeteer if available

export const pdfService = {
  async generateInvoicePDF(invoice: any): Promise<Buffer> {
    const html = generateHTML(invoice)
    
    // Try puppeteer if available (local dev)
    try {
      const puppeteer = require('puppeteer')
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true
      })
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }, printBackground: true })
      await browser.close()
      return Buffer.from(pdf)
    } catch(e) {
      // Puppeteer not available - return HTML as buffer
      // Client can print to PDF using browser
      return Buffer.from(html, 'utf-8')
    }
  },

  generateHTMLOnly(invoice: any): string {
    return generateHTML(invoice)
  }
}

function fmt(n: number, currency = 'GBP') {
  const symbols: any = { GBP:'£', USD:'$', EUR:'€', CAD:'C$', AUD:'A$', CHF:'Fr', JPY:'¥', INR:'₹', AED:'د.إ' }
  return (symbols[currency] || currency + ' ') + (+n || 0).toFixed(2)
}

function generateHTML(invoice: any): string {
  const p = invoice.profiles || {}
  const c = invoice.clients || {}
  const items = invoice.invoice_items || []
  const currency = invoice.currency || 'GBP'
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;color:#1e293b;font-size:13px}
.hdr{background:#0f172a;color:#fff;padding:36px 48px;display:flex;justify-content:space-between;align-items:start}
.hdr h1{font-size:20px;font-weight:700}.hdr .sub{color:#94a3b8;font-size:12px;margin-top:4px}
.inv-num{font-size:20px;font-weight:700;text-align:right}
.inv-status{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#22c55e;color:#fff;margin-top:6px;text-transform:uppercase}
.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;padding:24px 48px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
.meta label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;display:block;margin-bottom:4px}
.content{padding:24px 48px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead tr{background:#0f172a;color:#fff}
th{padding:9px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase}
th:last-child,td:last-child{text-align:right}
td{padding:11px 12px;border-bottom:1px solid #f1f5f9}
.totals{display:flex;justify-content:flex-end}.totals-box{width:260px}
.trow{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#6b7280;border-bottom:1px solid #f1f5f9}
.ttotal{display:flex;justify-content:space-between;padding:10px 0;font-size:16px;font-weight:700;border-top:2px solid #0f172a;margin-top:4px}
.notes{margin-top:20px;padding:14px;background:#f8fafc;border-left:3px solid #0f172a;font-size:13px;color:#374151;line-height:1.6}
.footer{margin-top:28px;padding:16px 48px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
@media print{body{-webkit-print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
  <div><h1>${p.company_name || p.full_name || 'Your Company'}</h1><div class="sub">${p.company_address || ''}${p.tax_number ? ' · VAT: ' + p.tax_number : ''}</div></div>
  <div><div class="inv-num">INVOICE</div><div style="color:#94a3b8;font-size:16px;margin-top:2px">${invoice.invoice_number}</div><div><span class="inv-status">${invoice.status}</span></div></div>
</div>
<div class="meta">
  <div><label>Bill to</label><div style="font-weight:600">${c.name || '—'}</div>${c.email ? `<div style="color:#2563eb;font-size:12px">${c.email}</div>` : ''}</div>
  <div><label>Dates</label><div><strong>Issue:</strong> ${new Date(invoice.issue_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div><div><strong>Due:</strong> ${new Date(invoice.due_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div></div>
  <div style="text-align:right"><label>Amount due</label><div style="font-size:26px;font-weight:800;color:#0f172a">${fmt(invoice.total,currency)}</div>${invoice.status==='paid'?'<div style="color:#16a34a;font-weight:600;margin-top:4px">✓ Paid</div>':''}</div>
</div>
<div class="content">
  <table><thead><tr><th style="width:50%">Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit price</th><th>Amount</th></tr></thead>
  <tbody>${items.map((item: any) => `<tr><td>${item.description}</td><td style="text-align:center;color:#6b7280">${item.quantity}</td><td style="text-align:right">${fmt(item.unit_price,currency)}</td><td>${fmt(item.amount,currency)}</td></tr>`).join('')}</tbody></table>
  <div class="totals"><div class="totals-box">
    <div class="trow"><span>Subtotal</span><span>${fmt(invoice.subtotal||0,currency)}</span></div>
    ${invoice.discount_amount>0?`<div class="trow"><span>Discount</span><span>-${fmt(invoice.discount_amount,currency)}</span></div>`:''}
    ${invoice.tax_amount>0?`<div class="trow"><span>VAT (${invoice.tax_rate}%)</span><span>${fmt(invoice.tax_amount,currency)}</span></div>`:''}
    ${invoice.late_fee_amount>0?`<div class="trow" style="color:#dc2626"><span>Late fee</span><span>${fmt(invoice.late_fee_amount,currency)}</span></div>`:''}
    <div class="ttotal"><span>Total</span><span>${fmt(invoice.total,currency)}</span></div>
  </div></div>
  ${invoice.notes?`<div class="notes"><strong>Notes:</strong> ${invoice.notes}</div>`:''}
  ${invoice.terms?`<div class="notes" style="margin-top:8px"><strong>Terms:</strong> ${invoice.terms}</div>`:''}
</div>
<div class="footer"><span>${p.company_name||p.full_name||''}</span>${invoice.stripe_payment_link?`<span>Pay: ${invoice.stripe_payment_link}</span>`:''}</div>
</body></html>`
}
