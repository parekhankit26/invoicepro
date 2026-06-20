import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' })

const PLAN_PRICES: Record<string, { name: string; amount: number }> = {
  starter: { name: 'InvoicePro Starter', amount: 900 },
  pro: { name: 'InvoicePro Pro', amount: 1900 },
  enterprise: { name: 'InvoicePro Enterprise', amount: 4900 },
}

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, full_name, company_name } = req.body
  if (!email || !password || !full_name) return res.status(400).json({ error: 'Email, password and name required' })
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, company_name } })
  if (error) return res.status(400).json({ error: error.message })
  return res.status(201).json({ message: 'Account created', user: data.user })
})

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: 'Invalid credentials' })
  return res.json({ token: data.session?.access_token, user: data.user, session: data.session })
})

router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', req.user!.id).single()
  if (error) return res.status(404).json({ error: 'Profile not found' })
  return res.json(data)
})

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const allowed = ['full_name','company_name','company_address','company_phone','company_website','tax_number','default_currency','default_tax_rate','default_payment_terms']
  const updates: Record<string, any> = {}
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.user!.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

router.post('/upgrade', authenticate, async (req: AuthRequest, res: Response) => {
  const { plan } = req.body
  const p = PLAN_PRICES[plan]
  if (!p) return res.status(400).json({ error: 'Invalid plan' })
  try {
    const base = process.env.FRONTEND_URL || 'https://invoicepro.asproite.com'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price_data: { currency: 'gbp', product_data: { name: p.name }, recurring: { interval: 'month' }, unit_amount: p.amount }, quantity: 1 }],
      success_url: `${base}/settings?upgraded=1`,
      cancel_url: `${base}/settings`,
      metadata: { user_id: req.user!.id, plan },
    })
    return res.json({ url: session.url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

router.delete('/account', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  try {
    for (const table of ['invoices', 'quotes', 'expenses', 'clients', 'time_entries', 'satisfaction_scores']) {
      await supabase.from(table).delete().eq('user_id', userId)
    }
    await supabase.from('profiles').delete().eq('id', userId)
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ message: 'Account deleted successfully' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
