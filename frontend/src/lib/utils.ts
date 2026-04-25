import { format, formatDistanceToNow, isPast } from 'date-fns'
export const CURRENCIES = [
  { code: 'GBP', symbol: '£', name: 'British Pound' },{ code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },{ code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },{ code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },{ code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },{ code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
]
export const CURRENCY_SYMBOLS: Record<string,string> = Object.fromEntries(CURRENCIES.map(c => [c.code, c.symbol]))
export function formatCurrency(amount: number, currency = 'GBP'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' '
  return `${symbol}${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
export function formatDate(date: string | Date): string { return format(new Date(date), 'd MMM yyyy') }
export function formatRelative(date: string | Date): string { return formatDistanceToNow(new Date(date), { addSuffix: true }) }
export function isOverdue(dueDate: string, status: string): boolean { return status !== 'paid' && status !== 'cancelled' && isPast(new Date(dueDate)) }
export function getStatusClass(status: string): string {
  const map: Record<string,string> = { paid: 'badge-paid', pending: 'badge-pending', overdue: 'badge-overdue', draft: 'badge-draft', sent: 'badge-sent', cancelled: 'badge-cancelled', accepted: 'badge-paid', declined: 'badge-overdue', converted: 'badge-sent' }
  return map[status] || 'badge-draft'
}
