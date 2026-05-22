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

// Currencies with no decimal places
const NO_DECIMALS = new Set(['JPY','KRW','VND','IDR','HUF','CLP'])

function fmtMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || (currency + ' ')
  const decimals = NO_DECIMALS.has(currency) ? 0 : 2
  const num = amount.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return `${sym}${num}`
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

        // ── Always recalculate from stored fields — never trust stored tax_lines
        // This ensures correct values even for invoices saved before any tax fix
        const subtotal = items.length > 0
          ? items.reduce((s: number, i: any) => s + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0)
          : Number(invoice.subtotal || 0)

        const discountPercent = Number(invoice.discount_percent || 0)
        const taxRate = Number(invoice.tax_rate || 0)
        const countryCode = invoice.country_code || 'GB'
        const taxType = invoice.tax_type || 'CGST_SGST'

        const taxResult = calculateTax(subtotal, discountPercent, taxRate, countryCode, taxType)
        const { discountAmount, taxableAmount, taxLines, totalTax, total } = taxResult

        // ── Header ─────────────────────────────────────────────
        doc.fontSize(28).fillColor('#1a1814').text('INVOICE', 50, 50)
        doc.fontSize(10).fillColor('#666').text(`#${invoice.invoice_number || 'N/A'}`, 50, 85)

        // Company info (right side)
        const company = invoice.company_name || invoice.from_company || 'Your Company'
        doc.fontSize(14).fillColor('#1a1814').text(company, 350, 50, { align: 'right', width: 200 })
        if (invoice.from_address) doc.fontSize(9).fillColor('#666').text(invoice.from_address, 350, 70, { align: 'right', width: 200 })
        if (invoice.from_email) doc.fontSize(9).fillColor('#666').text(invoice.from_email, 350, 85, { align: 'right', width: 200 })

        // Line separator
        doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#e5e5e5').stroke()

        // Bill to
        doc.fontSize(10).fillColor('#888').text('BILL TO', 50, 150)
        doc.fontSize(12).fillColor('#1a1814').text(invoice.client_name || invoice.bill_to || 'Client', 50, 165)
        if (invoice.client_email) doc.fontSize(10).fillColor('#666').text(invoice.client_email, 50, 182)
        if (invoice.client_address) doc.fontSize(10).fillColor('#666').text(invoice.client_address, 50, 197)

        // Invoice details
        doc.fontSize(10).fillColor('#888').text('ISSUE DATE', 350, 150)
        doc.fontSize(11).fillColor('#1a1814').text(invoice.issue_date || new Date().toLocaleDateString(), 350, 165)
        doc.fontSize(10).fillColor('#888').text('DUE DATE', 450, 150)
        doc.fontSize(11).fillColor('#1a1814').text(invoice.due_date || '-', 450, 165)

        // ── Items table ────────────────────────────────────────
        let y = 250
        doc.rect(50, y, 495, 25).fillColor('#f5f5f5').fill()
        doc.fontSize(9).fillColor('#666').text('DESCRIPTION', 60, y + 8)
        doc.text('QTY', 320, y + 8, { width: 50, align: 'right' })
        doc.text('PRICE', 380, y + 8, { width: 70, align: 'right' })
        doc.text('AMOUNT', 460, y + 8, { width: 80, align: 'right' })
        y += 35

        items.forEach((item: any) => {
          const qty = Number(item.quantity || 1)
          const price = Number(item.unit_price || 0)
          const amount = qty * price
          doc.fontSize(10).fillColor('#1a1814').text(item.description || 'Item', 60, y, { width: 250 })
          doc.text(String(qty), 320, y, { width: 50, align: 'right' })
          doc.text(fmtMoney(price, currency), 380, y, { width: 70, align: 'right' })
          doc.text(fmtMoney(amount, currency), 460, y, { width: 80, align: 'right' })
          y += 25
        })

        // ── Totals ─────────────────────────────────────────────
        y += 20
        doc.moveTo(350, y).lineTo(545, y).strokeColor('#e5e5e5').stroke()
        y += 10

        // Subtotal
        doc.fontSize(10).fillColor('#666').text('Subtotal', 350, y)
        doc.fillColor('#1a1814').text(fmtMoney(subtotal, currency), 460, y, { width: 80, align: 'right' })
        y += 18

        // Discount + taxable amount (only when discount > 0)
        if (discountAmount > 0) {
          doc.fillColor('#666').text(discountPercent > 0 ? `Discount (${discountPercent}%)` : 'Discount', 350, y)
          doc.fillColor('#e74c3c').text(`-${fmtMoney(discountAmount, currency)}`, 460, y, { width: 80, align: 'right' })
          y += 18
          doc.fillColor('#888').text('Taxable Amount', 350, y)
          doc.fillColor('#1a1814').text(fmtMoney(taxableAmount, currency), 460, y, { width: 80, align: 'right' })
          y += 18
        }

        // Tax lines — CGST+SGST, IGST, VAT, GST etc. — all computed correctly
        taxLines.forEach((line) => {
          doc.fillColor('#666').text(line.label, 350, y)
          doc.fillColor('#1a1814').text(fmtMoney(line.amount, currency), 460, y, { width: 80, align: 'right' })
          y += 18
        })

        // No tax label
        if (taxRate === 0 && taxLines.length === 0) {
          doc.fillColor('#888').text('Tax (0% — Exempt)', 350, y)
          doc.fillColor('#888').text('—', 460, y, { width: 80, align: 'right' })
          y += 18
        }

        // Late fee
        const lateFee = Number(invoice.late_fee_amount || 0)
        if (lateFee > 0) {
          doc.fillColor('#666').text('Late fee', 350, y)
          doc.fillColor('#e74c3c').text(fmtMoney(lateFee, currency), 460, y, { width: 80, align: 'right' })
          y += 18
        }

        // Total
        y += 5
        doc.moveTo(350, y).lineTo(545, y).strokeColor('#1a1814').lineWidth(1.5).stroke()
        y += 10
        doc.fontSize(13).fillColor('#1a1814').text('Total', 350, y)
        doc.fontSize(13).text(fmtMoney(total + lateFee, currency), 460, y, { width: 80, align: 'right' })

        // Paid stamp
        if (invoice.status === 'paid') {
          doc.fontSize(20).fillColor('#10b981').text('PAID', 50, y - 30)
        }

        // ── Notes / Footer ─────────────────────────────────────
        if (invoice.notes) {
          y += 50
          doc.fontSize(10).fillColor('#888').text('NOTES', 50, y)
          doc.fontSize(10).fillColor('#1a1814').text(invoice.notes, 50, y + 15, { width: 495 })
        }

        doc.fontSize(8).fillColor('#999').text(
          `Generated by InvoicePro · ${new Date().toLocaleDateString()}`,
          50, 780, { align: 'center', width: 495 }
        )

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
