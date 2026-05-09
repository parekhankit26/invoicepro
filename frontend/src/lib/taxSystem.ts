// ============================================================
// InvoicePro — Country-wise Tax System
// Covers: UK, USA, India, EU, Canada, Australia, UAE,
//         Singapore, Japan, Switzerland, South Africa, NZ
// ============================================================

export type TaxLineItem = {
  label: string       // e.g. "CGST (9%)", "VAT (20%)", "GST (10%)"
  rate: number        // percentage
  amount: number      // calculated amount
  isCompound?: boolean // applied on top of previous tax
}

export type TaxResult = {
  subtotal: number
  discountAmount: number
  taxableAmount: number
  taxLines: TaxLineItem[]
  totalTax: number
  total: number
  taxSummaryLabel: string  // Short label for PDF e.g. "VAT", "GST", "GST/HST"
}

export type CountryTaxConfig = {
  country: string
  currency: string
  taxSystem: string          // e.g. "VAT", "GST", "GST+PST", "Sales Tax", "GST (CGST+SGST)"
  defaultRate: number
  rates: { label: string; rate: number }[]
  supportsMultipleTaxLines: boolean
  taxLabel: string
  description: string
  uiHint: string
}

// ─── Country Tax Configurations ────────────────────────────────────────────
export const COUNTRY_TAX_CONFIGS: Record<string, CountryTaxConfig> = {
  GB: {
    country: 'United Kingdom',
    currency: 'GBP',
    taxSystem: 'VAT',
    defaultRate: 20,
    rates: [
      { label: 'Standard rate (20%)', rate: 20 },
      { label: 'Reduced rate (5%)', rate: 5 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'VAT',
    description: 'UK VAT — applied after discount per HMRC rules',
    uiHint: 'Standard 20% for most goods/services. 5% for domestic fuel/power.',
  },
  US: {
    country: 'United States',
    currency: 'USD',
    taxSystem: 'Sales Tax',
    defaultRate: 0,
    rates: [
      { label: 'No sales tax (0%)', rate: 0 },
      { label: 'California (8.25%)', rate: 8.25 },
      { label: 'Texas (8.25%)', rate: 8.25 },
      { label: 'New York (8.875%)', rate: 8.875 },
      { label: 'Florida (7%)', rate: 7 },
      { label: 'Illinois (10.25%)', rate: 10.25 },
      { label: 'Washington (10.4%)', rate: 10.4 },
      { label: 'Custom rate', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'Sales Tax',
    description: 'US Sales Tax — varies by state. Applied on taxable goods only.',
    uiHint: 'Services may be exempt. Enter your state rate or use a preset.',
  },
  IN: {
    country: 'India',
    currency: 'INR',
    taxSystem: 'GST',
    defaultRate: 18,
    rates: [
      { label: 'Nil (0%)', rate: 0 },
      { label: '5% GST', rate: 5 },
      { label: '12% GST', rate: 12 },
      { label: '18% GST (standard)', rate: 18 },
      { label: '28% GST (luxury)', rate: 28 },
    ],
    supportsMultipleTaxLines: true,
    taxLabel: 'GST',
    description: 'Indian GST — split into CGST + SGST (intra-state) or IGST (inter-state)',
    uiHint: '18% applies to most IT services. 12% for some goods.',
  },
  AU: {
    country: 'Australia',
    currency: 'AUD',
    taxSystem: 'GST',
    defaultRate: 10,
    rates: [
      { label: 'GST (10%)', rate: 10 },
      { label: 'GST Exempt (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'GST',
    description: 'Australian GST — flat 10% on most goods and services',
    uiHint: 'Basic food, medical, education are GST-free.',
  },
  CA: {
    country: 'Canada',
    currency: 'CAD',
    taxSystem: 'GST/HST',
    defaultRate: 5,
    rates: [
      { label: 'GST only — AB/NT/NU/YT (5%)', rate: 5 },
      { label: 'HST — ON (13%)', rate: 13 },
      { label: 'HST — NB/NL/NS/PEI (15%)', rate: 15 },
      { label: 'GST+QST — QC (14.975%)', rate: 14.975 },
      { label: 'GST+PST — BC (12%)', rate: 12 },
      { label: 'GST+PST — SK (11%)', rate: 11 },
      { label: 'GST+PST — MB (12%)', rate: 12 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'GST/HST',
    description: 'Canadian GST/HST — varies by province',
    uiHint: 'Select your province rate. Quebec uses GST + QST.',
  },
  AE: {
    country: 'United Arab Emirates',
    currency: 'AED',
    taxSystem: 'VAT',
    defaultRate: 5,
    rates: [
      { label: 'Standard VAT (5%)', rate: 5 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'VAT',
    description: 'UAE VAT — 5% flat rate introduced Jan 2018',
    uiHint: 'Most goods and services are 5%. Healthcare/education may be 0%.',
  },
  SG: {
    country: 'Singapore',
    currency: 'SGD',
    taxSystem: 'GST',
    defaultRate: 9,
    rates: [
      { label: 'GST (9%)', rate: 9 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'GST',
    description: 'Singapore GST — 9% (increased from 8% in Jan 2024)',
    uiHint: 'Exported goods and international services are zero-rated.',
  },
  JP: {
    country: 'Japan',
    currency: 'JPY',
    taxSystem: 'Consumption Tax',
    defaultRate: 10,
    rates: [
      { label: 'Standard (10%)', rate: 10 },
      { label: 'Reduced — food & drink (8%)', rate: 8 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'Consumption Tax',
    description: 'Japan Consumption Tax — 10% standard, 8% for food',
    uiHint: 'Food and non-alcoholic drinks qualify for 8% reduced rate.',
  },
  CH: {
    country: 'Switzerland',
    currency: 'CHF',
    taxSystem: 'VAT',
    defaultRate: 8.1,
    rates: [
      { label: 'Standard (8.1%)', rate: 8.1 },
      { label: 'Reduced (2.6%)', rate: 2.6 },
      { label: 'Special (3.8%) — accommodation', rate: 3.8 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'MWST/TVA',
    description: 'Swiss VAT — one of the lowest in Europe at 8.1%',
    uiHint: 'Food/books/medical are 2.6%. Hotel stays are 3.8%.',
  },
  ZA: {
    country: 'South Africa',
    currency: 'ZAR',
    taxSystem: 'VAT',
    defaultRate: 15,
    rates: [
      { label: 'Standard (15%)', rate: 15 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'VAT',
    description: 'South African VAT — 15% standard rate',
    uiHint: 'Basic foodstuffs and exports are zero-rated.',
  },
  NZ: {
    country: 'New Zealand',
    currency: 'NZD',
    taxSystem: 'GST',
    defaultRate: 15,
    rates: [
      { label: 'GST (15%)', rate: 15 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'GST',
    description: 'New Zealand GST — 15% broad-based',
    uiHint: 'Most goods and services. Exported goods are zero-rated.',
  },
  DE: {
    country: 'Germany',
    currency: 'EUR',
    taxSystem: 'VAT',
    defaultRate: 19,
    rates: [
      { label: 'Standard (19%)', rate: 19 },
      { label: 'Reduced (7%)', rate: 7 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'MwSt',
    description: 'German VAT (MwSt) — 19% standard',
    uiHint: 'Food, books, public transport use 7% reduced rate.',
  },
  FR: {
    country: 'France',
    currency: 'EUR',
    taxSystem: 'VAT',
    defaultRate: 20,
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Intermediate (10%)', rate: 10 },
      { label: 'Reduced (5.5%)', rate: 5.5 },
      { label: 'Super reduced (2.1%)', rate: 2.1 },
    ],
    supportsMultipleTaxLines: false,
    taxLabel: 'TVA',
    description: 'French VAT (TVA) — 20% standard',
    uiHint: 'Restaurants/hotels use 10%. Food/books use 5.5%.',
  },
  OTHER: {
    country: 'Other / Custom',
    currency: 'USD',
    taxSystem: 'Custom',
    defaultRate: 0,
    rates: [{ label: 'Custom rate', rate: 0 }],
    supportsMultipleTaxLines: false,
    taxLabel: 'Tax',
    description: 'Custom tax — enter your own rate',
    uiHint: 'Enter any tax rate that applies to your business.',
  },
}

// Currency → country code mapping for auto-detection
export const CURRENCY_TO_COUNTRY: Record<string, string> = {
  GBP: 'GB', USD: 'US', INR: 'IN', AUD: 'AU', CAD: 'CA',
  AED: 'AE', SGD: 'SG', JPY: 'JP', CHF: 'CH', EUR: 'DE',
  ZAR: 'ZA', NZD: 'NZ',
}

// ─── Core Tax Calculator ────────────────────────────────────────────────────
export function calculateTax(
  subtotal: number,
  discountPercent: number,
  taxRate: number,
  countryCode: string,
  taxType?: string   // 'IGST' | 'CGST_SGST' for India
): TaxResult {
  const discountAmount = subtotal * (discountPercent / 100)
  const taxableAmount = subtotal - discountAmount
  const config = COUNTRY_TAX_CONFIGS[countryCode] || COUNTRY_TAX_CONFIGS['OTHER']
  const taxLines: TaxLineItem[] = []

  if (taxRate === 0) {
    return {
      subtotal, discountAmount, taxableAmount,
      taxLines: [], totalTax: 0,
      total: taxableAmount,
      taxSummaryLabel: config.taxLabel,
    }
  }

  // India: Split GST into CGST + SGST or show as IGST
  if (countryCode === 'IN') {
    const isInterState = taxType === 'IGST'
    if (isInterState) {
      const igstAmount = taxableAmount * (taxRate / 100)
      taxLines.push({ label: `IGST (${taxRate}%)`, rate: taxRate, amount: igstAmount })
    } else {
      const halfRate = taxRate / 2
      const cgst = taxableAmount * (halfRate / 100)
      const sgst = taxableAmount * (halfRate / 100)
      taxLines.push({ label: `CGST (${halfRate}%)`, rate: halfRate, amount: cgst })
      taxLines.push({ label: `SGST (${halfRate}%)`, rate: halfRate, amount: sgst })
    }
  } else {
    // All other countries: single tax line
    const taxAmount = taxableAmount * (taxRate / 100)
    taxLines.push({
      label: `${config.taxLabel} (${taxRate}%)`,
      rate: taxRate,
      amount: taxAmount,
    })
  }

  const totalTax = taxLines.reduce((s, l) => s + l.amount, 0)
  const total = taxableAmount + totalTax

  return {
    subtotal, discountAmount, taxableAmount,
    taxLines, totalTax,
    total,
    taxSummaryLabel: config.taxLabel,
  }
}

export const COUNTRY_LIST = Object.entries(COUNTRY_TAX_CONFIGS).map(([code, cfg]) => ({
  code,
  label: `${cfg.country} — ${cfg.taxSystem}`,
  currency: cfg.currency,
  config: cfg,
}))
