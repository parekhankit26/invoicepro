import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, full_name, company_name } = (req as any).body
  if (!email || !password || !full_name) return res.status(400).json({ error: 'Email, password and name required' })
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, company_name } })
  if (error) return res.status(400).json({ error: error.message })
  return res.status(201).json({ message: 'Account created', user: data.user })
})

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = (req as any).body
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: 'Invalid credentials' })
  return res.json({ token: data.session?.access_token, user: data.user, session: data.session })
})

router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', (req as any).user!.id).single()
  if (error) return res.status(404).json({ error: 'Profile not found' })
  return res.json(data)
})

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const allowed = ['full_name','company_name','company_address','company_phone','company_website','tax_number','default_currency','default_tax_rate','default_payment_terms']
  const updates: Record<string, any> = {}
  allowed.forEach(k => { if ((req as any).body[k] !== undefined) updates[k] = (req as any).body[k] })
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', (req as any).user!.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

export default router
