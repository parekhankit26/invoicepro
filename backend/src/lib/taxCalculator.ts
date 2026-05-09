// InvoicePro — Backend Tax Calculator (mirrors frontend taxSystem.ts)
// 60+ countries, all currencies

export type TaxLine = { label: string; rate: number; amount: number }
export type TaxResult = {
  subtotal: number; discountAmount: number; taxableAmount: number
  taxLines: TaxLine[]; totalTax: number; total: number; taxSummaryLabel: string
}

const TAX_LABELS: Record<string, string> = {
  GB:'VAT', US:'Sales Tax', IN:'GST', AU:'GST', CA:'GST/HST',
  AE:'VAT', SG:'GST', JP:'Consumption Tax', CH:'MWST/TVA',
  ZA:'VAT', NZ:'GST', DE:'MwSt', FR:'TVA', IT:'IVA', ES:'IVA',
  NL:'BTW', BE:'BTW/TVA', PT:'IVA', AT:'MwSt', SE:'Moms', NO:'MVA',
  DK:'Moms', FI:'ALV', PL:'PTU', CZ:'DPH', HU:'ÁFA', RO:'TVA',
  BG:'ДДС', MX:'IVA', BR:'ICMS/ISS', AR:'IVA', CL:'IVA', CO:'IVA',
  PE:'IGV', CN:'VAT', KR:'VAT', HK:'No GST', MY:'SST', TH:'VAT',
  ID:'PPN', PH:'VAT', VN:'VAT', BD:'VAT', PK:'GST', LK:'VAT',
  NP:'VAT', SA:'VAT', QA:'No VAT', KW:'No VAT', BH:'VAT', OM:'VAT',
  IL:'VAT', TR:'KDV', EG:'VAT', NG:'VAT', KE:'VAT', GH:'VAT+Levies',
  MA:'TVA', RU:'НДС', UA:'ПДВ', OTHER:'Tax',
}

export function calculateTax(
  subtotal: number, discountPercent: number, taxRate: number,
  countryCode = 'GB', taxType = 'CGST_SGST'
): TaxResult {
  const discountAmount = subtotal * (discountPercent / 100)
  const taxableAmount = subtotal - discountAmount
  const taxLabel = TAX_LABELS[countryCode] || 'Tax'
  const taxLines: TaxLine[] = []

  if (taxRate > 0) {
    if (countryCode === 'IN') {
      if (taxType === 'IGST') {
        taxLines.push({ label: `IGST (${taxRate}%)`, rate: taxRate, amount: taxableAmount * (taxRate / 100) })
      } else {
        const half = taxRate / 2
        taxLines.push({ label: `CGST (${half}%)`, rate: half, amount: taxableAmount * (half / 100) })
        taxLines.push({ label: `SGST (${half}%)`, rate: half, amount: taxableAmount * (half / 100) })
      }
    } else {
      taxLines.push({ label: `${taxLabel} (${taxRate}%)`, rate: taxRate, amount: taxableAmount * (taxRate / 100) })
    }
  }

  const totalTax = taxLines.reduce((s, l) => s + l.amount, 0)
  return { subtotal, discountAmount, taxableAmount, taxLines, totalTax, total: taxableAmount + totalTax, taxSummaryLabel: taxLabel }
}
