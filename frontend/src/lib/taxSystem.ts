// ============================================================
// InvoicePro — Complete Global Tax System
// 60+ countries, every currency covered
// ============================================================

export type TaxLineItem = {
  label: string
  rate: number
  amount: number
}

export type TaxResult = {
  subtotal: number
  discountAmount: number
  taxableAmount: number
  taxLines: TaxLineItem[]
  totalTax: number
  total: number
  taxSummaryLabel: string
}

export type CountryTaxConfig = {
  country: string
  currency: string
  flag: string
  taxSystem: string
  defaultRate: number
  rates: { label: string; rate: number }[]
  supportsMultipleTaxLines: boolean
  taxLabel: string
  description: string
  uiHint: string
}

export const COUNTRY_TAX_CONFIGS: Record<string, CountryTaxConfig> = {

  // ── EUROPE ────────────────────────────────────────────────
  GB: {
    country: 'United Kingdom', currency: 'GBP', flag: '🇬🇧',
    taxSystem: 'VAT', defaultRate: 20, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Reduced (5%)', rate: 5 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'UK VAT — HMRC compliant, applied after discount',
    uiHint: '20% for most goods/services. 5% for domestic fuel & power. Food & children\'s clothing are 0%.',
  },
  DE: {
    country: 'Germany', currency: 'EUR', flag: '🇩🇪',
    taxSystem: 'VAT (MwSt)', defaultRate: 19, taxLabel: 'MwSt',
    rates: [
      { label: 'Standard (19%)', rate: 19 },
      { label: 'Reduced (7%)', rate: 7 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'German Mehrwertsteuer — standard 19%',
    uiHint: '7% for food, books, public transport. 19% for most services.',
  },
  FR: {
    country: 'France', currency: 'EUR', flag: '🇫🇷',
    taxSystem: 'VAT (TVA)', defaultRate: 20, taxLabel: 'TVA',
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Intermediate (10%)', rate: 10 },
      { label: 'Reduced (5.5%)', rate: 5.5 },
      { label: 'Super reduced (2.1%)', rate: 2.1 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'French TVA — 20% standard',
    uiHint: 'Restaurants/hotels 10%. Food/books 5.5%. Medicines 2.1%.',
  },
  IT: {
    country: 'Italy', currency: 'EUR', flag: '🇮🇹',
    taxSystem: 'VAT (IVA)', defaultRate: 22, taxLabel: 'IVA',
    rates: [
      { label: 'Standard (22%)', rate: 22 },
      { label: 'Reduced (10%)', rate: 10 },
      { label: 'Reduced (5%)', rate: 5 },
      { label: 'Super reduced (4%)', rate: 4 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Italian IVA — 22% standard rate',
    uiHint: '10% for food, some tourism. 4% for basic food items, books.',
  },
  ES: {
    country: 'Spain', currency: 'EUR', flag: '🇪🇸',
    taxSystem: 'VAT (IVA)', defaultRate: 21, taxLabel: 'IVA',
    rates: [
      { label: 'Standard (21%)', rate: 21 },
      { label: 'Reduced (10%)', rate: 10 },
      { label: 'Super reduced (4%)', rate: 4 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Spanish IVA — 21% standard',
    uiHint: '10% for food, hotels. 4% for basic necessities.',
  },
  NL: {
    country: 'Netherlands', currency: 'EUR', flag: '🇳🇱',
    taxSystem: 'VAT (BTW)', defaultRate: 21, taxLabel: 'BTW',
    rates: [
      { label: 'Standard (21%)', rate: 21 },
      { label: 'Reduced (9%)', rate: 9 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Dutch BTW — 21% standard',
    uiHint: '9% for food, medicine, books. 21% for most services.',
  },
  BE: {
    country: 'Belgium', currency: 'EUR', flag: '🇧🇪',
    taxSystem: 'VAT (BTW/TVA)', defaultRate: 21, taxLabel: 'BTW/TVA',
    rates: [
      { label: 'Standard (21%)', rate: 21 },
      { label: 'Reduced (12%)', rate: 12 },
      { label: 'Reduced (6%)', rate: 6 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Belgian VAT — 21% standard',
    uiHint: '6% for basic necessities, medicine. 12% for some services.',
  },
  PT: {
    country: 'Portugal', currency: 'EUR', flag: '🇵🇹',
    taxSystem: 'VAT (IVA)', defaultRate: 23, taxLabel: 'IVA',
    rates: [
      { label: 'Standard (23%)', rate: 23 },
      { label: 'Intermediate (13%)', rate: 13 },
      { label: 'Reduced (6%)', rate: 6 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Portuguese IVA — 23% standard',
    uiHint: '13% for food services, wine. 6% for basic food, medicine.',
  },
  AT: {
    country: 'Austria', currency: 'EUR', flag: '🇦🇹',
    taxSystem: 'VAT (MwSt/USt)', defaultRate: 20, taxLabel: 'MwSt',
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Reduced (13%)', rate: 13 },
      { label: 'Reduced (10%)', rate: 10 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Austrian VAT — 20% standard',
    uiHint: '10% for food, books, medicine. 13% for art, culture.',
  },
  SE: {
    country: 'Sweden', currency: 'SEK', flag: '🇸🇪',
    taxSystem: 'VAT (Moms)', defaultRate: 25, taxLabel: 'Moms',
    rates: [
      { label: 'Standard (25%)', rate: 25 },
      { label: 'Reduced (12%)', rate: 12 },
      { label: 'Reduced (6%)', rate: 6 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Swedish Moms — 25% standard, one of EU\'s highest',
    uiHint: '12% for food, hotels. 6% for newspapers, passenger transport.',
  },
  NO: {
    country: 'Norway', currency: 'NOK', flag: '🇳🇴',
    taxSystem: 'VAT (MVA)', defaultRate: 25, taxLabel: 'MVA',
    rates: [
      { label: 'Standard (25%)', rate: 25 },
      { label: 'Reduced (15%)', rate: 15 },
      { label: 'Reduced (12%)', rate: 12 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Norwegian MVA — 25% standard',
    uiHint: '15% for food. 12% for passenger transport, cinema.',
  },
  DK: {
    country: 'Denmark', currency: 'DKK', flag: '🇩🇰',
    taxSystem: 'VAT (Moms)', defaultRate: 25, taxLabel: 'Moms',
    rates: [
      { label: 'Standard (25%)', rate: 25 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Danish Moms — flat 25%, no reduced rates',
    uiHint: 'Denmark has only one rate — 25% for almost everything.',
  },
  FI: {
    country: 'Finland', currency: 'EUR', flag: '🇫🇮',
    taxSystem: 'VAT (ALV)', defaultRate: 25.5, taxLabel: 'ALV',
    rates: [
      { label: 'Standard (25.5%)', rate: 25.5 },
      { label: 'Reduced (14%)', rate: 14 },
      { label: 'Reduced (10%)', rate: 10 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Finnish ALV — 25.5% standard (raised 2024)',
    uiHint: '14% for food. 10% for books, medicine, passenger transport.',
  },
  CH: {
    country: 'Switzerland', currency: 'CHF', flag: '🇨🇭',
    taxSystem: 'VAT (MWST)', defaultRate: 8.1, taxLabel: 'MWST/TVA',
    rates: [
      { label: 'Standard (8.1%)', rate: 8.1 },
      { label: 'Reduced (2.6%)', rate: 2.6 },
      { label: 'Special (3.8%) — accommodation', rate: 3.8 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Swiss MWST — lowest VAT in Europe at 8.1%',
    uiHint: '2.6% for food, books, medicine. 3.8% for hotel stays.',
  },
  PL: {
    country: 'Poland', currency: 'PLN', flag: '🇵🇱',
    taxSystem: 'VAT (PTU)', defaultRate: 23, taxLabel: 'PTU',
    rates: [
      { label: 'Standard (23%)', rate: 23 },
      { label: 'Reduced (8%)', rate: 8 },
      { label: 'Reduced (5%)', rate: 5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Polish VAT — 23% standard',
    uiHint: '8% for construction, some food. 5% for basic food, books.',
  },
  CZ: {
    country: 'Czech Republic', currency: 'CZK', flag: '🇨🇿',
    taxSystem: 'VAT (DPH)', defaultRate: 21, taxLabel: 'DPH',
    rates: [
      { label: 'Standard (21%)', rate: 21 },
      { label: 'Reduced (12%)', rate: 12 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Czech VAT — 21% standard',
    uiHint: '12% for food, medical, books, accommodation.',
  },
  HU: {
    country: 'Hungary', currency: 'HUF', flag: '🇭🇺',
    taxSystem: 'VAT (ÁFA)', defaultRate: 27, taxLabel: 'ÁFA',
    rates: [
      { label: 'Standard (27%)', rate: 27 },
      { label: 'Reduced (18%)', rate: 18 },
      { label: 'Reduced (5%)', rate: 5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Hungarian ÁFA — 27%, highest VAT in EU',
    uiHint: '18% for basic food, hotel. 5% for medicine, books.',
  },
  RO: {
    country: 'Romania', currency: 'RON', flag: '🇷🇴',
    taxSystem: 'VAT (TVA)', defaultRate: 19, taxLabel: 'TVA',
    rates: [
      { label: 'Standard (19%)', rate: 19 },
      { label: 'Reduced (9%)', rate: 9 },
      { label: 'Reduced (5%)', rate: 5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Romanian TVA — 19% standard',
    uiHint: '9% for food, medicine, hotels. 5% for books, housing.',
  },
  BG: {
    country: 'Bulgaria', currency: 'BGN', flag: '🇧🇬',
    taxSystem: 'VAT (ДДС)', defaultRate: 20, taxLabel: 'ДДС',
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Reduced (9%)', rate: 9 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Bulgarian VAT — 20% standard',
    uiHint: '9% for hotel accommodation, books.',
  },

  // ── AMERICAS ──────────────────────────────────────────────
  US: {
    country: 'United States', currency: 'USD', flag: '🇺🇸',
    taxSystem: 'Sales Tax', defaultRate: 0, taxLabel: 'Sales Tax',
    rates: [
      { label: 'No sales tax — OR/MT/NH/DE/AK (0%)', rate: 0 },
      { label: 'California (8.25%)', rate: 8.25 },
      { label: 'Texas (8.25%)', rate: 8.25 },
      { label: 'New York (8.875%)', rate: 8.875 },
      { label: 'Florida (7%)', rate: 7 },
      { label: 'Illinois (10.25%)', rate: 10.25 },
      { label: 'Washington (10.4%)', rate: 10.4 },
      { label: 'Nevada (8.375%)', rate: 8.375 },
      { label: 'Arizona (8.4%)', rate: 8.4 },
      { label: 'Ohio (7.25%)', rate: 7.25 },
      { label: 'Georgia (7%)', rate: 7 },
      { label: 'Colorado (7.65%)', rate: 7.65 },
      { label: 'Custom rate', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'US Sales Tax — no federal VAT, varies by state',
    uiHint: 'Services often exempt. B2B may use exemption certificates. 5 states have no sales tax.',
  },
  CA: {
    country: 'Canada', currency: 'CAD', flag: '🇨🇦',
    taxSystem: 'GST/HST/PST', defaultRate: 5, taxLabel: 'GST/HST',
    rates: [
      { label: 'GST only — AB/NT/NU/YT (5%)', rate: 5 },
      { label: 'HST — Ontario (13%)', rate: 13 },
      { label: 'HST — New Brunswick (15%)', rate: 15 },
      { label: 'HST — Newfoundland (15%)', rate: 15 },
      { label: 'HST — Nova Scotia (15%)', rate: 15 },
      { label: 'HST — Prince Edward Island (15%)', rate: 15 },
      { label: 'GST+QST — Quebec (14.975%)', rate: 14.975 },
      { label: 'GST+PST — British Columbia (12%)', rate: 12 },
      { label: 'GST+PST — Saskatchewan (11%)', rate: 11 },
      { label: 'GST+PST — Manitoba (12%)', rate: 12 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Canadian GST/HST — varies by province',
    uiHint: 'Quebec uses GST + QST separately. Harmonised provinces use HST.',
  },
  MX: {
    country: 'Mexico', currency: 'MXN', flag: '🇲🇽',
    taxSystem: 'VAT (IVA)', defaultRate: 16, taxLabel: 'IVA',
    rates: [
      { label: 'Standard (16%)', rate: 16 },
      { label: 'Border zone (8%)', rate: 8 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Mexican IVA — 16% standard nationwide',
    uiHint: '8% applies in border regions. Food & medicine are 0%.',
  },
  BR: {
    country: 'Brazil', currency: 'BRL', flag: '🇧🇷',
    taxSystem: 'VAT (ICMS/ISS)', defaultRate: 17, taxLabel: 'ICMS/ISS',
    rates: [
      { label: 'ICMS Standard (17%)', rate: 17 },
      { label: 'ICMS — SP/RJ/MG (18%)', rate: 18 },
      { label: 'ISS Services (2–5%) — use 3%', rate: 3 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Brazilian tax — ICMS for goods, ISS for services',
    uiHint: 'Brazil has complex multi-level taxes. ICMS varies by state. ISS for services.',
  },
  AR: {
    country: 'Argentina', currency: 'ARS', flag: '🇦🇷',
    taxSystem: 'VAT (IVA)', defaultRate: 21, taxLabel: 'IVA',
    rates: [
      { label: 'Standard (21%)', rate: 21 },
      { label: 'Reduced (10.5%)', rate: 10.5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Argentine IVA — 21% standard',
    uiHint: '10.5% for some food, medical equipment. 0% for books.',
  },
  CL: {
    country: 'Chile', currency: 'CLP', flag: '🇨🇱',
    taxSystem: 'VAT (IVA)', defaultRate: 19, taxLabel: 'IVA',
    rates: [
      { label: 'Standard (19%)', rate: 19 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Chilean IVA — flat 19%',
    uiHint: 'Most goods and services. Exports are zero-rated.',
  },
  CO: {
    country: 'Colombia', currency: 'COP', flag: '🇨🇴',
    taxSystem: 'VAT (IVA)', defaultRate: 19, taxLabel: 'IVA',
    rates: [
      { label: 'Standard (19%)', rate: 19 },
      { label: 'Reduced (5%)', rate: 5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Colombian IVA — 19% standard',
    uiHint: '5% for some food, computers. 0% for basic necessities.',
  },
  PE: {
    country: 'Peru', currency: 'PEN', flag: '🇵🇪',
    taxSystem: 'VAT (IGV)', defaultRate: 18, taxLabel: 'IGV',
    rates: [
      { label: 'Standard (18%)', rate: 18 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Peruvian IGV — 18% standard',
    uiHint: 'IGV = Impuesto General a las Ventas. Exports exempt.',
  },

  // ── ASIA PACIFIC ──────────────────────────────────────────
  IN: {
    country: 'India', currency: 'INR', flag: '🇮🇳',
    taxSystem: 'GST (CGST+SGST / IGST)', defaultRate: 18, taxLabel: 'GST',
    rates: [
      { label: 'Nil (0%)', rate: 0 },
      { label: '5% GST', rate: 5 },
      { label: '12% GST', rate: 12 },
      { label: '18% GST — standard IT/services', rate: 18 },
      { label: '28% GST — luxury goods', rate: 28 },
    ],
    supportsMultipleTaxLines: true,
    description: 'Indian GST — CGST+SGST for intra-state, IGST for inter-state',
    uiHint: '18% for most IT & professional services. Choose intra-state or inter-state below.',
  },
  AU: {
    country: 'Australia', currency: 'AUD', flag: '🇦🇺',
    taxSystem: 'GST', defaultRate: 10, taxLabel: 'GST',
    rates: [
      { label: 'GST (10%)', rate: 10 },
      { label: 'GST Free (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Australian GST — flat 10%',
    uiHint: 'Basic food, medical, education are GST-free.',
  },
  NZ: {
    country: 'New Zealand', currency: 'NZD', flag: '🇳🇿',
    taxSystem: 'GST', defaultRate: 15, taxLabel: 'GST',
    rates: [
      { label: 'GST (15%)', rate: 15 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'NZ GST — broad-based 15%',
    uiHint: 'Most goods and services. Exported goods are zero-rated.',
  },
  SG: {
    country: 'Singapore', currency: 'SGD', flag: '🇸🇬',
    taxSystem: 'GST', defaultRate: 9, taxLabel: 'GST',
    rates: [
      { label: 'GST (9%)', rate: 9 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Singapore GST — 9% (increased Jan 2024)',
    uiHint: 'International services and exported goods are zero-rated.',
  },
  JP: {
    country: 'Japan', currency: 'JPY', flag: '🇯🇵',
    taxSystem: 'Consumption Tax', defaultRate: 10, taxLabel: 'Consumption Tax',
    rates: [
      { label: 'Standard (10%)', rate: 10 },
      { label: 'Reduced — food & non-alcoholic drinks (8%)', rate: 8 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Japan Consumption Tax — 10% standard',
    uiHint: '8% for food and non-alcoholic drinks (take-away).',
  },
  CN: {
    country: 'China', currency: 'CNY', flag: '🇨🇳',
    taxSystem: 'VAT (增值税)', defaultRate: 13, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (13%)', rate: 13 },
      { label: 'Reduced (9%)', rate: 9 },
      { label: 'Services (6%)', rate: 6 },
      { label: 'Small taxpayer (3%)', rate: 3 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Chinese VAT — 13% for goods, 6% for services',
    uiHint: '9% for agriculture/utilities. 6% for modern services. 3% for small taxpayers.',
  },
  KR: {
    country: 'South Korea', currency: 'KRW', flag: '🇰🇷',
    taxSystem: 'VAT (부가가치세)', defaultRate: 10, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (10%)', rate: 10 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Korean VAT — flat 10%',
    uiHint: 'Exports, international transport are zero-rated.',
  },
  HK: {
    country: 'Hong Kong', currency: 'HKD', flag: '🇭🇰',
    taxSystem: 'No VAT / Profits Tax', defaultRate: 0, taxLabel: 'No GST',
    rates: [
      { label: 'No VAT/GST (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Hong Kong has NO VAT or GST — only Profits Tax on income',
    uiHint: 'HK has no sales tax. Profits Tax is 8.25% (small) or 16.5% (standard) — applied to profits, not invoices.',
  },
  MY: {
    country: 'Malaysia', currency: 'MYR', flag: '🇲🇾',
    taxSystem: 'SST (Sales & Service Tax)', defaultRate: 8, taxLabel: 'SST',
    rates: [
      { label: 'Service Tax (8%)', rate: 8 },
      { label: 'Sales Tax (10%)', rate: 10 },
      { label: 'Sales Tax reduced (5%)', rate: 5 },
      { label: 'Exempt (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Malaysian SST — 8% service tax (increased 2024)',
    uiHint: '8% on most services. 10% on manufactured goods. Some food exempt.',
  },
  TH: {
    country: 'Thailand', currency: 'THB', flag: '🇹🇭',
    taxSystem: 'VAT (ภาษีมูลค่าเพิ่ม)', defaultRate: 7, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (7%)', rate: 7 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Thai VAT — 7% (temporarily reduced from 10%)',
    uiHint: 'Exports, international services are zero-rated.',
  },
  ID: {
    country: 'Indonesia', currency: 'IDR', flag: '🇮🇩',
    taxSystem: 'VAT (PPN)', defaultRate: 11, taxLabel: 'PPN',
    rates: [
      { label: 'Standard (11%)', rate: 11 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Indonesian PPN — 11% (increased from 10% in 2022)',
    uiHint: 'Basic necessities, medical, education are exempt.',
  },
  PH: {
    country: 'Philippines', currency: 'PHP', flag: '🇵🇭',
    taxSystem: 'VAT (EVAT)', defaultRate: 12, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (12%)', rate: 12 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Philippine VAT — 12%',
    uiHint: 'Exports, international shipping are zero-rated.',
  },
  VN: {
    country: 'Vietnam', currency: 'VND', flag: '🇻🇳',
    taxSystem: 'VAT (Thuế GTGT)', defaultRate: 10, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (10%)', rate: 10 },
      { label: 'Reduced (5%)', rate: 5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Vietnamese VAT — 10% standard',
    uiHint: '5% for essential goods, medical, education.',
  },
  BD: {
    country: 'Bangladesh', currency: 'BDT', flag: '🇧🇩',
    taxSystem: 'VAT (মূসক)', defaultRate: 15, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (15%)', rate: 15 },
      { label: 'Reduced (7.5%)', rate: 7.5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Bangladesh VAT — 15% standard',
    uiHint: '7.5% for trading, some services.',
  },
  PK: {
    country: 'Pakistan', currency: 'PKR', flag: '🇵🇰',
    taxSystem: 'GST / Sales Tax', defaultRate: 18, taxLabel: 'GST',
    rates: [
      { label: 'Standard (18%)', rate: 18 },
      { label: 'Reduced (10%)', rate: 10 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Pakistan GST — 18% standard',
    uiHint: 'Basic food, agriculture may be exempt.',
  },
  LK: {
    country: 'Sri Lanka', currency: 'LKR', flag: '🇱🇰',
    taxSystem: 'VAT', defaultRate: 18, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (18%)', rate: 18 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Sri Lanka VAT — 18% (doubled in 2023)',
    uiHint: 'Exports and specified supplies are zero-rated.',
  },
  NP: {
    country: 'Nepal', currency: 'NPR', flag: '🇳🇵',
    taxSystem: 'VAT', defaultRate: 13, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (13%)', rate: 13 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Nepal VAT — 13%',
    uiHint: 'Basic food, agriculture, medical are exempt.',
  },

  // ── MIDDLE EAST ───────────────────────────────────────────
  AE: {
    country: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪',
    taxSystem: 'VAT', defaultRate: 5, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (5%)', rate: 5 },
      { label: 'Zero rated (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'UAE VAT — 5% introduced Jan 2018',
    uiHint: 'Healthcare, education, local transport may be 0%.',
  },
  SA: {
    country: 'Saudi Arabia', currency: 'SAR', flag: '🇸🇦',
    taxSystem: 'VAT', defaultRate: 15, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (15%)', rate: 15 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Saudi VAT — 15% (tripled in 2020)',
    uiHint: 'Exports and some financial services are zero-rated.',
  },
  QA: {
    country: 'Qatar', currency: 'QAR', flag: '🇶🇦',
    taxSystem: 'No VAT', defaultRate: 0, taxLabel: 'No VAT',
    rates: [{ label: 'No VAT (0%)', rate: 0 }],
    supportsMultipleTaxLines: false,
    description: 'Qatar — no VAT currently',
    uiHint: 'Qatar has not implemented VAT yet. Check for updates.',
  },
  KW: {
    country: 'Kuwait', currency: 'KWD', flag: '🇰🇼',
    taxSystem: 'No VAT', defaultRate: 0, taxLabel: 'No VAT',
    rates: [{ label: 'No VAT (0%)', rate: 0 }],
    supportsMultipleTaxLines: false,
    description: 'Kuwait — no VAT',
    uiHint: 'Kuwait has no VAT or sales tax.',
  },
  BH: {
    country: 'Bahrain', currency: 'BHD', flag: '🇧🇭',
    taxSystem: 'VAT', defaultRate: 10, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (10%)', rate: 10 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Bahrain VAT — 10% (doubled in 2022)',
    uiHint: 'Healthcare, education, local transport are zero-rated.',
  },
  OM: {
    country: 'Oman', currency: 'OMR', flag: '🇴🇲',
    taxSystem: 'VAT', defaultRate: 5, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (5%)', rate: 5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Oman VAT — 5% introduced 2021',
    uiHint: 'Basic food, medical, education are exempt.',
  },
  IL: {
    country: 'Israel', currency: 'ILS', flag: '🇮🇱',
    taxSystem: 'VAT (מע"מ)', defaultRate: 17, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (17%)', rate: 17 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Israeli VAT — 17%',
    uiHint: 'Exports and some tourism services are zero-rated.',
  },
  TR: {
    country: 'Turkey', currency: 'TRY', flag: '🇹🇷',
    taxSystem: 'VAT (KDV)', defaultRate: 20, taxLabel: 'KDV',
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Reduced (10%)', rate: 10 },
      { label: 'Reduced (1%)', rate: 1 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Turkish KDV — raised to 20% in 2023',
    uiHint: '10% for food, textile. 1% for basic staples.',
  },

  // ── AFRICA ────────────────────────────────────────────────
  ZA: {
    country: 'South Africa', currency: 'ZAR', flag: '🇿🇦',
    taxSystem: 'VAT', defaultRate: 15, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (15%)', rate: 15 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'South African VAT — 15%',
    uiHint: 'Basic food, paraffin, exports are zero-rated.',
  },
  NG: {
    country: 'Nigeria', currency: 'NGN', flag: '🇳🇬',
    taxSystem: 'VAT', defaultRate: 7.5, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (7.5%)', rate: 7.5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Nigerian VAT — 7.5% (increased 2020)',
    uiHint: 'Basic food, medical, educational materials are exempt.',
  },
  KE: {
    country: 'Kenya', currency: 'KES', flag: '🇰🇪',
    taxSystem: 'VAT', defaultRate: 16, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (16%)', rate: 16 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Kenyan VAT — 16%',
    uiHint: 'Exports, agricultural equipment are zero-rated.',
  },
  GH: {
    country: 'Ghana', currency: 'GHS', flag: '🇬🇭',
    taxSystem: 'VAT + NHIL + GETFL', defaultRate: 21.9, taxLabel: 'VAT+Levies',
    rates: [
      { label: 'VAT (15%) + NHIL (2.5%) + GETFL (4%) = 21.9% effective', rate: 21.9 },
      { label: 'Flat rate VAT — small businesses (4%)', rate: 4 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Ghana VAT 15% + NHIL 2.5% + GETFL 4% = 21.5% effective',
    uiHint: 'Standard invoice shows 21.9% effective total. Small businesses use flat 4%.',
  },
  MA: {
    country: 'Morocco', currency: 'MAD', flag: '🇲🇦',
    taxSystem: 'VAT (TVA)', defaultRate: 20, taxLabel: 'TVA',
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Reduced (14%)', rate: 14 },
      { label: 'Reduced (10%)', rate: 10 },
      { label: 'Reduced (7%)', rate: 7 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Moroccan TVA — 20% standard',
    uiHint: '14% for water/electricity. 10% for hotels/restaurants. 7% for banking.',
  },
  EG: {
    country: 'Egypt', currency: 'EGP', flag: '🇪🇬',
    taxSystem: 'VAT', defaultRate: 14, taxLabel: 'VAT',
    rates: [
      { label: 'Standard (14%)', rate: 14 },
      { label: 'Table A (5%)', rate: 5 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Egyptian VAT — 14%',
    uiHint: '5% for some goods under Schedule A. Exports are zero-rated.',
  },

  // ── EASTERN EUROPE / CENTRAL ASIA ─────────────────────────
  RU: {
    country: 'Russia', currency: 'RUB', flag: '🇷🇺',
    taxSystem: 'VAT (НДС)', defaultRate: 20, taxLabel: 'НДС',
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Reduced (10%)', rate: 10 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Russian VAT (НДС) — 20% standard',
    uiHint: '10% for food, medicine, children\'s goods. 0% for exports.',
  },
  UA: {
    country: 'Ukraine', currency: 'UAH', flag: '🇺🇦',
    taxSystem: 'VAT (ПДВ)', defaultRate: 20, taxLabel: 'ПДВ',
    rates: [
      { label: 'Standard (20%)', rate: 20 },
      { label: 'Reduced (7%)', rate: 7 },
      { label: 'Zero (0%)', rate: 0 },
    ],
    supportsMultipleTaxLines: false,
    description: 'Ukrainian VAT — 20% standard',
    uiHint: '7% for medicine, medical devices.',
  },

  // ── CUSTOM / FALLBACK ─────────────────────────────────────
  OTHER: {
    country: 'Other / Custom', currency: 'USD', flag: '🌍',
    taxSystem: 'Custom', defaultRate: 0, taxLabel: 'Tax',
    rates: [{ label: 'Custom rate', rate: 0 }],
    supportsMultipleTaxLines: false,
    description: 'Enter your own custom tax rate',
    uiHint: 'Enter any tax rate that applies to your jurisdiction.',
  },
}

// ─── Currency → Default Country mapping ────────────────────────────────────
export const CURRENCY_TO_COUNTRY: Record<string, string> = {
  GBP: 'GB', USD: 'US', EUR: 'DE', CAD: 'CA', AUD: 'AU',
  CHF: 'CH', JPY: 'JP', INR: 'IN', SGD: 'SG', AED: 'AE',
  CNY: 'CN', HKD: 'HK', KRW: 'KR', MYR: 'MY', THB: 'TH',
  IDR: 'ID', PHP: 'PH', VND: 'VN', BDT: 'BD', PKR: 'PK',
  LKR: 'LK', NPR: 'NP', NZD: 'NZ', SAR: 'SA', QAR: 'QA',
  KWD: 'KW', BHD: 'BH', OMR: 'OM', ILS: 'IL', TRY: 'TR',
  EGP: 'EG', ZAR: 'ZA', NGN: 'NG', KES: 'KE', GHS: 'GH',
  MAD: 'MA', SEK: 'SE', NOK: 'NO', DKK: 'DK', PLN: 'PL',
  CZK: 'CZ', HUF: 'HU', RON: 'RO', BGN: 'BG', RUB: 'RU',
  UAH: 'UA', MXN: 'MX', BRL: 'BR', ARS: 'AR', CLP: 'CL',
  COP: 'CO', PEN: 'PE',
}

// ─── Core Tax Calculator ────────────────────────────────────────────────────
export function calculateTax(
  subtotal: number,
  discountPercent: number,
  taxRate: number,
  countryCode: string,
  taxType?: string
): TaxResult {
  const discountAmount = subtotal * (discountPercent / 100)
  const taxableAmount = subtotal - discountAmount
  const config = COUNTRY_TAX_CONFIGS[countryCode] || COUNTRY_TAX_CONFIGS['OTHER']
  const taxLines: TaxLineItem[] = []

  if (taxRate > 0) {
    if (countryCode === 'IN') {
      // India: CGST+SGST or IGST
      if (taxType === 'IGST') {
        taxLines.push({ label: `IGST (${taxRate}%)`, rate: taxRate, amount: taxableAmount * (taxRate / 100) })
      } else {
        const half = taxRate / 2
        taxLines.push({ label: `CGST (${half}%)`, rate: half, amount: taxableAmount * (half / 100) })
        taxLines.push({ label: `SGST (${half}%)`, rate: half, amount: taxableAmount * (half / 100) })
      }
    } else {
      const taxAmount = taxableAmount * (taxRate / 100)
      taxLines.push({ label: `${config.taxLabel} (${taxRate}%)`, rate: taxRate, amount: taxAmount })
    }
  }

  const totalTax = taxLines.reduce((s, l) => s + l.amount, 0)
  return {
    subtotal, discountAmount, taxableAmount,
    taxLines, totalTax,
    total: taxableAmount + totalTax,
    taxSummaryLabel: config.taxLabel,
  }
}

export const COUNTRY_LIST = Object.entries(COUNTRY_TAX_CONFIGS).map(([code, cfg]) => ({
  code,
  label: `${cfg.flag} ${cfg.country} — ${cfg.taxSystem}`,
  currency: cfg.currency,
  config: cfg,
}))
