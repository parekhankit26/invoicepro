import { format, formatDistanceToNow, isPast } from 'date-fns'

export const CURRENCIES = [
  // Major
  { code: 'GBP', symbol: '£',    name: 'British Pound' },
  { code: 'USD', symbol: '$',    name: 'US Dollar' },
  { code: 'EUR', symbol: '€',    name: 'Euro' },
  { code: 'CAD', symbol: 'C$',   name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'Fr',   name: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen' },
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee' },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  // Asia Pacific
  { code: 'CNY', symbol: '¥',    name: 'Chinese Yuan' },
  { code: 'HKD', symbol: 'HK$',  name: 'Hong Kong Dollar' },
  { code: 'KRW', symbol: '₩',    name: 'South Korean Won' },
  { code: 'MYR', symbol: 'RM',   name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿',    name: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp',   name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱',    name: 'Philippine Peso' },
  { code: 'VND', symbol: '₫',    name: 'Vietnamese Dong' },
  { code: 'BDT', symbol: '৳',    name: 'Bangladeshi Taka' },
  { code: 'PKR', symbol: '₨',    name: 'Pakistani Rupee' },
  { code: 'LKR', symbol: 'Rs',   name: 'Sri Lankan Rupee' },
  { code: 'NPR', symbol: 'Rs',   name: 'Nepalese Rupee' },
  { code: 'NZD', symbol: 'NZ$',  name: 'New Zealand Dollar' },
  // Middle East & Africa
  { code: 'SAR', symbol: '﷼',    name: 'Saudi Riyal' },
  { code: 'QAR', symbol: 'QR',   name: 'Qatari Riyal' },
  { code: 'KWD', symbol: 'KD',   name: 'Kuwaiti Dinar' },
  { code: 'BHD', symbol: 'BD',   name: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'OMR',  name: 'Omani Rial' },
  { code: 'ILS', symbol: '₪',    name: 'Israeli Shekel' },
  { code: 'TRY', symbol: '₺',    name: 'Turkish Lira' },
  { code: 'EGP', symbol: 'E£',   name: 'Egyptian Pound' },
  { code: 'ZAR', symbol: 'R',    name: 'South African Rand' },
  { code: 'NGN', symbol: '₦',    name: 'Nigerian Naira' },
  { code: 'KES', symbol: 'KSh',  name: 'Kenyan Shilling' },
  { code: 'GHS', symbol: '₵',    name: 'Ghanaian Cedi' },
  { code: 'MAD', symbol: 'MAD',  name: 'Moroccan Dirham' },
  // Europe (non-EUR)
  { code: 'SEK', symbol: 'kr',   name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr',   name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr',   name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł',   name: 'Polish Zloty' },
  { code: 'CZK', symbol: 'Kč',   name: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft',   name: 'Hungarian Forint' },
  { code: 'RON', symbol: 'lei',  name: 'Romanian Leu' },
  { code: 'BGN', symbol: 'лв',   name: 'Bulgarian Lev' },
  { code: 'RUB', symbol: '₽',    name: 'Russian Ruble' },
  { code: 'UAH', symbol: '₴',    name: 'Ukrainian Hryvnia' },
  // Americas
  { code: 'MXN', symbol: '$',    name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$',   name: 'Brazilian Real' },
  { code: 'ARS', symbol: '$',    name: 'Argentine Peso' },
  { code: 'CLP', symbol: '$',    name: 'Chilean Peso' },
  { code: 'COP', symbol: '$',    name: 'Colombian Peso' },
  { code: 'PEN', symbol: 'S/.',  name: 'Peruvian Sol' },
]

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map(c => [c.code, c.symbol])
)

export function formatCurrency(amount: number, currency = 'GBP'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' '
  // JPY, KRW, VND, IDR — no decimals
  const noDecimals = ['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'CLP']
  const decimals = noDecimals.includes(currency) ? 0 : 2
  return `${symbol}${amount.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export function formatDate(date: string | Date): string { return format(new Date(date), 'd MMM yyyy') }
export function formatRelative(date: string | Date): string { return formatDistanceToNow(new Date(date), { addSuffix: true }) }
export function isOverdue(dueDate: string, status: string): boolean { return status !== 'paid' && status !== 'cancelled' && isPast(new Date(dueDate)) }
export function getStatusClass(status: string): string {
  const map: Record<string, string> = { paid: 'badge-paid', pending: 'badge-pending', overdue: 'badge-overdue', draft: 'badge-draft', sent: 'badge-sent', cancelled: 'badge-cancelled', accepted: 'badge-paid', declined: 'badge-overdue', converted: 'badge-sent' }
  return map[status] || 'badge-draft'
}
