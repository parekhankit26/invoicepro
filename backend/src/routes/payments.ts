import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'

const router = Router()
router.use(authenticate)

router.get('/', async (req: AuthRequest, res: Response) => {
  const { invoice_id, from, to } = req.query
  let query = supabase.from('payments').select(`*, invoices(invoice_number, clients(name))`).eq('user_id', req.user!.id).order('paid_at', { ascending: false })
  if (invoice_id) query = query.eq('invoice_id', invoice_id)
  if (from) query = query.gte('paid_at', from as string)
  if (to) query = query.lte('paid_at', to as string)
  const { data, error } = await query
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

router.post('/', async (req: AuthRequest, res: Response) => {
  const { invoice_id, amount, method, reference, notes, paid_at } = req.body
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoice_id).eq('user_id', req.user!.id).single()
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  const { data, error } = await supabase.from('payments').insert({ user_id: req.user!.id, invoice_id, amount, currency: invoice.currency, method: method || 'manual', reference, notes, paid_at: paid_at || new Date().toISOString(), status: 'completed' }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  const totalPaid = (invoice.amount_paid || 0) + amount
  if (totalPaid >= invoice.total) await supabase.from('invoices').update({ status: 'paid', amount_paid: totalPaid, paid_at: new Date().toISOString() }).eq('id', invoice_id)
  return res.status(201).json(data)
})

export default router
