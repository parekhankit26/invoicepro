import PDFDocument from 'pdfkit'

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
        const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' '
        const items = invoice.items || []
        const subtotal = items.reduce((s: number, i: any) => s + (Number(i.quantity || 1) * Number(i.unit_price || 0)), 0)
        // Use stored values from DB if available, otherwise calculate
        const discountPercent = Number(invoice.discount_percent || invoice.discount || 0)
        const discountAmount = Number(invoice.discount_amount) || (subtotal * discountPercent / 100)
        const taxableAmount = subtotal - discountAmount
        const taxAmount = Number(invoice.tax_amount) || (taxableAmount * (Number(invoice.tax_rate || 0) / 100))
        const total = Number(invoice.total) || (taxableAmount + taxAmount)

        // Header
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

        // Items table header
        let y = 250
        doc.rect(50, y, 495, 25).fillColor('#f5f5f5').fill()
        doc.fontSize(9).fillColor('#666').text('DESCRIPTION', 60, y + 8)
        doc.text('QTY', 320, y + 8, { width: 50, align: 'right' })
        doc.text('PRICE', 380, y + 8, { width: 70, align: 'right' })
        doc.text('AMOUNT', 460, y + 8, { width: 80, align: 'right' })
        y += 35

        // Items
        items.forEach((item: any) => {
          const qty = Number(item.quantity || 1)
          const price = Number(item.unit_price || 0)
          const amount = qty * price
          doc.fontSize(10).fillColor('#1a1814').text(item.description || 'Item', 60, y, { width: 250 })
          doc.text(String(qty), 320, y, { width: 50, align: 'right' })
          doc.text(`${symbol}${price.toFixed(2)}`, 380, y, { width: 70, align: 'right' })
          doc.text(`${symbol}${amount.toFixed(2)}`, 460, y, { width: 80, align: 'right' })
          y += 25
        })

        // Totals
        y += 20
        doc.moveTo(350, y).lineTo(545, y).strokeColor('#e5e5e5').stroke()
        y += 10
        doc.fontSize(10).fillColor('#666').text('Subtotal', 350, y)
        doc.fillColor('#1a1814').text(`${symbol}${subtotal.toFixed(2)}`, 460, y, { width: 80, align: 'right' })
        y += 18
        if (taxAmount > 0) {
          doc.fillColor('#666').text(`Tax (${invoice.tax_rate}%)`, 350, y)
          doc.fillColor('#1a1814').text(`${symbol}${taxAmount.toFixed(2)}`, 460, y, { width: 80, align: 'right' })
          y += 18
        }
        if (discountAmount > 0) {
          doc.fillColor('#666').text(discountPercent > 0 ? `Discount (${discountPercent}%)` : 'Discount', 350, y)
          doc.fillColor('#e74c3c').text(`-${symbol}${discountAmount.toFixed(2)}`, 460, y, { width: 80, align: 'right' })
          y += 18
        }
        y += 5
        doc.moveTo(350, y).lineTo(545, y).strokeColor('#1a1814').lineWidth(1.5).stroke()
        y += 10
        doc.fontSize(13).fillColor('#1a1814').text('Total', 350, y)
        doc.fontSize(13).text(`${symbol}${total.toFixed(2)}`, 460, y, { width: 80, align: 'right' })

        // Status
        if (invoice.status === 'paid') {
          doc.fontSize(20).fillColor('#10b981').text('PAID', 50, y - 30)
        }

        // Footer notes
        if (invoice.notes) {
          y += 50
          doc.fontSize(10).fillColor('#888').text('NOTES', 50, y)
          doc.fontSize(10).fillColor('#1a1814').text(invoice.notes, 50, y + 15, { width: 495 })
        }

        // Payment terms
        doc.fontSize(8).fillColor('#999').text(`Generated by InvoicePro · ${new Date().toLocaleDateString()}`, 50, 780, { align: 'center', width: 495 })

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
