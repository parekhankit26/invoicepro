import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'

const router = Router()
router.use(authenticate)

router.get('/overview', async (req: AuthRequest, res: Response) => {
  const userId = (req as any).user!.id
  const now = new Date()
  const [invoicesRes, expensesRes, clientsRes] = await Promise.all([
    supabase.from('invoices').select('*').eq('user_id', userId),
    supabase.from('expenses').select('*').eq('user_id', userId),
    supabase.from('clients').select('id').eq('user_id', userId).eq('is_archived', false)
  ])
  const invoices = invoicesRes.data || []
  const expenses = expensesRes.data || []
  const totalBilled = invoices.reduce((s, i) => s + i.total, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalPending = invoices.filter(i => ['pending','sent'].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  const monthly: Record<string, any> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    monthly[key] = { revenue: 0, expenses: 0 }
  }
  invoices.filter(i => i.status === 'paid' && i.paid_at).forEach(inv => {
    const d = new Date(inv.paid_at!)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    if (monthly[key]) monthly[key].revenue += inv.total
  })
  expenses.forEach(exp => {
    const d = new Date(exp.date)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    if (monthly[key]) monthly[key].expenses += exp.amount
  })

  const overdueInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && new Date(i.due_date) < now).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).slice(0, 5)

  return res.json({
    summary: { total_billed: totalBilled, total_paid: totalPaid, total_pending: totalPending, total_overdue: totalOverdue, total_expenses: totalExpenses, net_profit: totalPaid - totalExpenses, payment_rate: totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0, client_count: clientsRes.data?.length || 0, invoice_count: invoices.length },
    monthly_chart: Object.entries(monthly).map(([month, vals]) => ({ month, ...vals })),
    status_breakdown: { draft: invoices.filter(i => i.status === 'draft').length, sent: invoices.filter(i => i.status === 'sent').length, pending: invoices.filter(i => i.status === 'pending').length, paid: invoices.filter(i => i.status === 'paid').length, overdue: invoices.filter(i => i.status === 'overdue').length },
    overdue_invoices: overdueInvoices
  })
})

export default router
