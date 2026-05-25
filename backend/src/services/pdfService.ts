import PDFDocument from 'pdfkit'
import { calculateTax } from '../lib/taxCalculator'

// Currency symbol map — covers all 60+ currencies in the system
const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP:'£', USD:'$', EUR:'€', INR:'₹', CAD:'C$', AUD:'A$', NZD:'NZ$', SGD:'S$',
  CHF:'Fr', JPY:'¥', CNY:'¥', HKD:'HK$', KRW:'₩', MYR:'RM', THB:'฿', IDR:'Rp',
  PHP:'₱', VND:'₫', BDT:'৳', PKR:'₨', LKR:'Rs', NPR:'Rs', AED:'د.إ', SAR:'﷼',
  QAR:'QR', KWD:'KD', BHD:'BD', OMR:'OMR', ILS:'₪', TRY:'₺', EGP:'E£', ZAR:'R',
  NGN:'₦', KES:'KSh', GHS:'₵', MAD:'MAD', SEK:'kr', NOK:'kr', DKK:'kr', PLN:'zł',
  CZK:'Kč', HUF:'Ft', RON:'lei', BGN:'лв', RUB:'₽', UAH:'₴', MXN:'$', BRL:'R$',
  ARS:'$', CLP:'$', COP:'$', PEN:'S/.',
}
const NO_DECIMALS = new Set(['JPY','KRW','VND','IDR','HUF','CLP'])

function fmtMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || (currency + ' ')
  const decimals = NO_DECIMALS.has(currency) ? 0 : 2
  return `${sym}${amount.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

// Parse a hex colour string to [r,g,b] (0-255)
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ]
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

// Decide whether white or dark text is more readable on a given background
function contrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#1a1814' : '#ffffff'
}

interface TemplateSettings {
  template: string
  primaryColor: string
  accentColor: string
  footerText: string
}

function getTemplate(raw: any): TemplateSettings {
  const defaults: TemplateSettings = {
    template: 'classic',
    primaryColor: '#1a1814',
    accentColor: '#a3e635',
    footerText: 'Thank you for your business!',
  }
  if (!raw) return defaults
  try {
    const t = typeof raw === 'string' ? JSON.parse(raw) : raw
    return {
      template: t.template || defaults.template,
      primaryColor: t.primaryColor || defaults.primaryColor,
      accentColor: t.accentColor || defaults.accentColor,
      footerText: t.footerText || defaults.footerText,
    }
  } catch { return defaults }
}

export const pdfService = {
  async generateInvoicePDF(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 })
        const chunks: Buffer[] = []
        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const currency = invoice.currency || 'GBP'
        const items = invoice.items || []
        const tpl = getTemplate(invoice.invoice_template)
        const { template, primaryColor, accentColor, footerText } = tpl
        const textOnPrimary = contrastText(primaryColor)
        const textOnAccent = contrastText(accentColor)

        // ── Recalculate totals from items ─────────────────────
        const subtotal = items.length > 0
          ? items.reduce((s: number, i: any) => s + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0)
          : Number(invoice.subtotal || 0)
        const discountPercent = Number(invoice.discount_percent || 0)
        const taxRate = Number(invoice.tax_rate || 0)
        const taxResult = calculateTax(subtotal, discountPercent, taxRate, invoice.country_code || 'GB', invoice.tax_type || 'CGST_SGST')
        const { discountAmount, taxableAmount, taxLines, total } = taxResult
        const lateFee = Number(invoice.late_fee_amount || 0)
        const grandTotal = total + lateFee

        const company = invoice.company_name || invoice.from_company || 'Your Company'
        const docType = invoice._type === 'quote' ? 'QUOTE' : 'INVOICE'
        const docNumber = invoice.invoice_number || invoice.quote_number || 'N/A'

        // ═══════════════════════════════════════════════════════
        // TEMPLATE: CLASSIC — full coloured header, coloured table header
        // ═══════════════════════════════════════════════════════
        if (template === 'classic') {
          // Header block
          doc.rect(0, 0, 595, 110).fill(primaryColor)

          // "INVOICE" label
          doc.fontSize(26).fillColor(textOnPrimary).text(docType, 50, 30)
          doc.fontSize(11).fillColor(textOnPrimary).opacity(0.7).text(`#${docNumber}`, 50, 63).opacity(1)

          // Company name + info (right)
          doc.fontSize(15).fillColor(textOnPrimary).text(company, 50, 28, { align: 'right', width: 490 })
          if (invoice.from_address) {
            doc.fontSize(9).fillColor(textOnPrimary).opacity(0.7).text(invoice.from_address, 50, 50, { align: 'right', width: 490 }).opacity(1)
          }
          if (invoice.from_email) {
            doc.fontSize(9).fillColor(textOnPrimary).opacity(0.7).text(invoice.from_email, 50, 63, { align: 'right', width: 490 }).opacity(1)
          }
          if (invoice.from_tax) {
            doc.fontSize(9).fillColor(textOnPrimary).opacity(0.7).text(invoice.from_tax, 50, 76, { align: 'right', width: 490 }).opacity(1)
          }

          // Accent DRAFT/status badge
          const status = (invoice.status || 'draft').toUpperCase()
          const badgeColor = invoice.status === 'paid' ? accentColor : (invoice.status === 'overdue' ? '#ef4444' : accentColor)
          doc.rect(50, 82, 55, 16).fill(badgeColor)
          doc.fontSize(8).fillColor(textOnAccent).text(status, 52, 86, { width: 51, align: 'center' })

          let y = 130

          // Bill To + Dates row
          doc.fontSize(8).fillColor('#888').text('BILL TO', 50, y)
          doc.fontSize(8).fillColor('#888').text('ISSUE DATE', 340, y)
          doc.fontSize(8).fillColor('#888').text('DUE DATE', 445, y)
          y += 14
          doc.fontSize(12).fillColor('#1a1814').text(invoice.client_name || 'Client', 50, y)
          doc.fontSize(11).fillColor('#1a1814').text(invoice.issue_date || '-', 340, y)
          doc.fontSize(11).fillColor('#1a1814').text(invoice.due_date || '-', 445, y)
          y += 14
          if (invoice.client_email) { doc.fontSize(9).fillColor('#666').text(invoice.client_email, 50, y); y += 12 }
          if (invoice.client_address) { doc.fontSize(9).fillColor('#666').text(invoice.client_address, 50, y, { width: 250 }); y += 24 }

          y += 16
          // Coloured table header
          doc.rect(50, y, 495, 24).fill(primaryColor)
          doc.fontSize(9).fillColor(textOnPrimary)
          doc.text('DESCRIPTION', 60, y + 7)
          doc.text('QTY',    340, y + 7, { width: 50, align: 'right' })
          doc.text('PRICE',  398, y + 7, { width: 65, align: 'right' })
          doc.text('AMOUNT', 468, y + 7, { width: 72, align: 'right' })
          y += 34

          items.forEach((item: any, i: number) => {
            if (i % 2 === 1) doc.rect(50, y - 4, 495, 22).fill('#f8f7f4')
            const qty = Number(item.quantity || 1)
            const price = Number(item.unit_price || 0)
            doc.fontSize(10).fillColor('#1a1814')
              .text(item.description || 'Item', 60, y, { width: 270 })
              .text(String(qty),               340, y, { width: 50, align: 'right' })
              .text(fmtMoney(price, currency), 398, y, { width: 65, align: 'right' })
              .text(fmtMoney(qty * price, currency), 468, y, { width: 72, align: 'right' })
            y += 24
          })
          y += 10

          doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e5e5').lineWidth(1).stroke()
          y += 12

          renderTotals(doc, y, subtotal, discountPercent, discountAmount, taxableAmount, taxLines, taxRate, lateFee, grandTotal, currency, primaryColor)
          renderStatus(doc, invoice.status, y - 30)
          renderFooter(doc, footerText, accentColor, invoice)
        }

        // ═══════════════════════════════════════════════════════
        // TEMPLATE: MODERN — white header, company name in primaryColor, accent left border
        // ═══════════════════════════════════════════════════════
        else if (template === 'modern') {
          // Left accent border
          doc.rect(0, 0, 6, 842).fill(primaryColor)

          let y = 50
          // Company (right side)
          doc.fontSize(16).fillColor(primaryColor).text(company, 50, y, { align: 'right', width: 490 })
          if (invoice.from_address) doc.fontSize(9).fillColor('#9ca3af').text(invoice.from_address, 50, y + 20, { align: 'right', width: 490 })
          if (invoice.from_email) doc.fontSize(9).fillColor('#9ca3af').text(invoice.from_email, 50, y + 32, { align: 'right', width: 490 })
          if (invoice.from_tax) doc.fontSize(9).fillColor('#9ca3af').text(invoice.from_tax, 50, y + 44, { align: 'right', width: 490 })

          // Doc type label (light grey uppercase)
          doc.fontSize(11).fillColor('#9ca3af').text(docType, 50, y)
          doc.fontSize(22).fillColor('#1a1814').text(`#${docNumber}`, 50, y + 14)

          y = 115
          doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e5e5').lineWidth(1).stroke()
          y += 16

          // Bill To + Dates
          doc.fontSize(8).fillColor('#9ca3af').text('BILL TO', 50, y)
          doc.fontSize(8).fillColor('#9ca3af').text('ISSUE DATE', 320, y)
          doc.fontSize(8).fillColor('#9ca3af').text('DUE DATE', 430, y)
          y += 13
          doc.fontSize(12).fillColor('#1a1814').text(invoice.client_name || 'Client', 50, y)
          doc.fontSize(10).fillColor('#374151').text(invoice.issue_date || '-', 320, y)
          doc.fontSize(10).fillColor('#374151').text(invoice.due_date || '-', 430, y)
          y += 13
          if (invoice.client_email) { doc.fontSize(9).fillColor('#6b7280').text(invoice.client_email, 50, y); y += 12 }
          if (invoice.client_address) { doc.fontSize(9).fillColor('#6b7280').text(invoice.client_address, 50, y, { width: 250 }); y += 24 }

          y += 16
          // Table header: thin bottom border only
          doc.moveTo(50, y + 22).lineTo(545, y + 22).strokeColor(primaryColor).lineWidth(2).stroke()
          doc.fontSize(9).fillColor('#9ca3af')
          doc.text('DESCRIPTION', 60, y + 6)
          doc.text('QTY',    340, y + 6, { width: 50, align: 'right' })
          doc.text('PRICE',  398, y + 6, { width: 65, align: 'right' })
          doc.text('AMOUNT', 468, y + 6, { width: 72, align: 'right' })
          y += 34

          items.forEach((item: any) => {
            const qty = Number(item.quantity || 1)
            const price = Number(item.unit_price || 0)
            doc.moveTo(50, y + 18).lineTo(545, y + 18).strokeColor('#f1f5f9').lineWidth(1).stroke()
            doc.fontSize(10).fillColor('#1a1814')
              .text(item.description || 'Item', 60, y, { width: 270 })
              .text(String(qty),               340, y, { width: 50, align: 'right' })
              .text(fmtMoney(price, currency), 398, y, { width: 65, align: 'right' })
              .text(fmtMoney(qty * price, currency), 468, y, { width: 72, align: 'right' })
            y += 24
          })
          y += 10

          renderTotals(doc, y, subtotal, discountPercent, discountAmount, taxableAmount, taxLines, taxRate, lateFee, grandTotal, currency, primaryColor)
          renderStatus(doc, invoice.status, y - 30)
          renderFooter(doc, footerText, accentColor, invoice)
        }

        // ═══════════════════════════════════════════════════════
        // TEMPLATE: BOLD — oversized company name, thick accent stripe
        // ═══════════════════════════════════════════════════════
        else if (template === 'bold') {
          // Full header block
          doc.rect(0, 0, 595, 120).fill(primaryColor)
          // Accent stripe at bottom of header
          doc.rect(0, 112, 595, 8).fill(accentColor)

          // Large company name
          doc.fontSize(28).fillColor(textOnPrimary).text(company, 50, 30, { align: 'left', width: 340 })
          if (invoice.from_address) doc.fontSize(9).fillColor(textOnPrimary).opacity(0.6).text(invoice.from_address, 50, 72).opacity(1)
          if (invoice.from_email) doc.fontSize(9).fillColor(textOnPrimary).opacity(0.6).text(invoice.from_email, 50, 84).opacity(1)

          // Doc type + number (right)
          doc.fontSize(13).fillColor(textOnPrimary).opacity(0.7).text(docType, 50, 30, { align: 'right', width: 490 }).opacity(1)
          doc.fontSize(20).fillColor(textOnPrimary).text(`#${docNumber}`, 50, 50, { align: 'right', width: 490 })

          let y = 140

          // Bill To + Amount (big)
          doc.fontSize(8).fillColor('#888').text('BILL TO', 50, y)
          doc.fontSize(8).fillColor('#888').text('ISSUE DATE', 310, y)
          doc.fontSize(8).fillColor('#888').text('DUE DATE', 420, y)
          y += 14
          doc.fontSize(13).fillColor('#1a1814').text(invoice.client_name || 'Client', 50, y)
          doc.fontSize(11).fillColor('#374151').text(invoice.issue_date || '-', 310, y)
          doc.fontSize(11).fillColor('#374151').text(invoice.due_date || '-', 420, y)
          y += 14
          if (invoice.client_email) { doc.fontSize(9).fillColor('#666').text(invoice.client_email, 50, y); y += 12 }
          if (invoice.client_address) { doc.fontSize(9).fillColor('#666').text(invoice.client_address, 50, y, { width: 260 }); y += 24 }

          y += 16
          // Table header with accent colour
          doc.rect(50, y, 495, 24).fill(accentColor)
          doc.fontSize(9).fillColor(textOnAccent)
          doc.text('DESCRIPTION', 60, y + 7)
          doc.text('QTY',    340, y + 7, { width: 50, align: 'right' })
          doc.text('PRICE',  398, y + 7, { width: 65, align: 'right' })
          doc.text('AMOUNT', 468, y + 7, { width: 72, align: 'right' })
          y += 34

          items.forEach((item: any, i: number) => {
            if (i % 2 === 1) doc.rect(50, y - 4, 495, 22).fill('#f9fafb')
            const qty = Number(item.quantity || 1)
            const price = Number(item.unit_price || 0)
            doc.fontSize(11).fillColor('#1a1814')
              .text(item.description || 'Item', 60, y, { width: 270 })
              .text(String(qty),               340, y, { width: 50, align: 'right' })
              .text(fmtMoney(price, currency), 398, y, { width: 65, align: 'right' })
              .text(fmtMoney(qty * price, currency), 468, y, { width: 72, align: 'right' })
            y += 26
          })
          y += 10

          doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e5e5').lineWidth(1).stroke()
          y += 12
          renderTotals(doc, y, subtotal, discountPercent, discountAmount, taxableAmount, taxLines, taxRate, lateFee, grandTotal, currency, primaryColor, true)
          renderStatus(doc, invoice.status, y - 30)
          renderFooter(doc, footerText, accentColor, invoice)
        }

        // ═══════════════════════════════════════════════════════
        // TEMPLATE: MINIMAL — all white, thin lines, light typography
        // ═══════════════════════════════════════════════════════
        else {
          let y = 50
          // Company (right)
          doc.fontSize(14).fillColor('#111827').text(company, 50, y, { align: 'right', width: 490 })
          if (invoice.from_address) doc.fontSize(9).fillColor('#9ca3af').text(invoice.from_address, 50, y + 18, { align: 'right', width: 490 })
          if (invoice.from_email) doc.fontSize(9).fillColor('#9ca3af').text(invoice.from_email, 50, y + 30, { align: 'right', width: 490 })
          if (invoice.from_tax) doc.fontSize(9).fillColor('#9ca3af').text(invoice.from_tax, 50, y + 42, { align: 'right', width: 490 })

          // Thin primary underline (40px wide on left)
          doc.rect(50, y + 40, 40, 2).fill(primaryColor)

          // Doc type (large light)
          doc.fontSize(28).fillColor('#d1d5db').text(docType, 50, y, { width: 200 })
          doc.fontSize(11).fillColor('#374151').text(`#${docNumber}`, 50, y + 36)

          y = 115
          doc.moveTo(50, y).lineTo(545, y).strokeColor('#f3f4f6').lineWidth(1).stroke()
          y += 16

          // Bill To + Dates
          doc.fontSize(8).fillColor('#d1d5db').text('BILL TO', 50, y)
          doc.fontSize(8).fillColor('#d1d5db').text('DATE', 330, y)
          doc.fontSize(8).fillColor('#d1d5db').text('DUE', 430, y)
          y += 13
          doc.fontSize(12).fillColor('#111827').text(invoice.client_name || 'Client', 50, y)
          doc.fontSize(10).fillColor('#374151').text(invoice.issue_date || '-', 330, y)
          doc.fontSize(10).fillColor('#374151').text(invoice.due_date || '-', 430, y)
          y += 13
          if (invoice.client_email) { doc.fontSize(9).fillColor('#9ca3af').text(invoice.client_email, 50, y); y += 12 }
          if (invoice.client_address) { doc.fontSize(9).fillColor('#9ca3af').text(invoice.client_address, 50, y, { width: 250 }); y += 24 }

          y += 16
          // Table: light gray header background
          doc.rect(50, y, 495, 22).fill('#f9fafb')
          doc.fontSize(9).fillColor('#9ca3af')
          doc.text('DESCRIPTION', 60, y + 6)
          doc.text('QTY',    340, y + 6, { width: 50, align: 'right' })
          doc.text('PRICE',  398, y + 6, { width: 65, align: 'right' })
          doc.text('AMOUNT', 468, y + 6, { width: 72, align: 'right' })
          y += 32

          items.forEach((item: any) => {
            const qty = Number(item.quantity || 1)
            const price = Number(item.unit_price || 0)
            doc.moveTo(50, y + 18).lineTo(545, y + 18).strokeColor('#f3f4f6').lineWidth(1).stroke()
            doc.fontSize(10).fillColor('#111827')
              .text(item.description || 'Item', 60, y, { width: 270 })
              .text(String(qty),               340, y, { width: 50, align: 'right' })
              .text(fmtMoney(price, currency), 398, y, { width: 65, align: 'right' })
              .text(fmtMoney(qty * price, currency), 468, y, { width: 72, align: 'right' })
            y += 24
          })
          y += 10

          doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').lineWidth(1).stroke()
          y += 12
          renderTotals(doc, y, subtotal, discountPercent, discountAmount, taxableAmount, taxLines, taxRate, lateFee, grandTotal, currency, primaryColor)
          renderStatus(doc, invoice.status, y - 30)
          renderFooter(doc, footerText, primaryColor, invoice)
        }

        doc.end()
      } catch (err) {
        reject(err)
      }
    })
  },

  generateHTMLOnly(invoice: any): string {
    return `<html><body><h1>Invoice ${invoice.invoice_number}</h1></body></html>`
  }
}

// ── Shared totals block ────────────────────────────────────────────────
function renderTotals(
  doc: any, y: number,
  subtotal: number, discountPercent: number, discountAmount: number,
  taxableAmount: number, taxLines: any[], taxRate: number,
  lateFee: number, grandTotal: number,
  currency: string, primaryColor: string, bold = false
) {
  const fs = bold ? 11 : 10
  if (discountAmount > 0) {
    doc.fontSize(fs).fillColor('#666').text(discountPercent > 0 ? `Discount (${discountPercent}%)` : 'Discount', 350, y)
    doc.fillColor('#ef4444').text(`-${fmtMoney(discountAmount, currency)}`, 460, y, { width: 80, align: 'right' })
    y += 18
    doc.fillColor('#888').text('Taxable Amount', 350, y)
    doc.fillColor('#1a1814').text(fmtMoney(taxableAmount, currency), 460, y, { width: 80, align: 'right' })
    y += 18
  } else {
    doc.fontSize(fs).fillColor('#666').text('Subtotal', 350, y)
    doc.fillColor('#1a1814').text(fmtMoney(subtotal, currency), 460, y, { width: 80, align: 'right' })
    y += 18
  }
  taxLines.forEach((line: any) => {
    doc.fontSize(fs).fillColor('#666').text(line.label, 350, y)
    doc.fillColor('#1a1814').text(fmtMoney(line.amount, currency), 460, y, { width: 80, align: 'right' })
    y += 18
  })
  if (taxRate === 0 && taxLines.length === 0) {
    doc.fontSize(fs).fillColor('#888').text('Tax (0% — Exempt)', 350, y)
    doc.fillColor('#888').text('—', 460, y, { width: 80, align: 'right' })
    y += 18
  }
  if (lateFee > 0) {
    doc.fontSize(fs).fillColor('#666').text('Late fee', 350, y)
    doc.fillColor('#ef4444').text(fmtMoney(lateFee, currency), 460, y, { width: 80, align: 'right' })
    y += 18
  }
  y += 5
  doc.moveTo(350, y).lineTo(545, y).strokeColor(primaryColor).lineWidth(1.5).stroke()
  y += 10
  doc.fontSize(bold ? 14 : 13).fillColor(primaryColor).text('Total', 350, y)
  doc.fontSize(bold ? 14 : 13).fillColor(primaryColor).text(fmtMoney(grandTotal, currency), 460, y, { width: 80, align: 'right' })
}

// ── PAID / status stamp ──────────────────────────────────────────────
function renderStatus(doc: any, status: string, y: number) {
  if (!status || status === 'draft' || status === 'sent') return
  const colors: Record<string, string> = { paid: '#10b981', overdue: '#ef4444', cancelled: '#9ca3af' }
  const color = colors[status] || '#6b7280'
  doc.fontSize(22).fillColor(color).opacity(0.85).text(status.toUpperCase(), 50, y).opacity(1)
}

// ── Footer ────────────────────────────────────────────────────────────
function renderFooter(doc: any, footerText: string, accentColor: string, invoice: any) {
  const pageBottom = 785
  doc.moveTo(50, pageBottom - 20).lineTo(545, pageBottom - 20).strokeColor('#e5e5e5').lineWidth(1).stroke()
  doc.fontSize(8).fillColor('#999').text(footerText || 'Thank you for your business!', 50, pageBottom - 12, { width: 300 })
  doc.fontSize(8).fillColor(accentColor).text('Generated by InvoicePro', 50, pageBottom - 12, { width: 490, align: 'right' })
  if (invoice.notes) {
    const notesY = pageBottom - 60
    doc.fontSize(8).fillColor('#888').text('NOTES', 50, notesY)
    doc.fontSize(9).fillColor('#374151').text(invoice.notes, 50, notesY + 12, { width: 495 })
  }
}
