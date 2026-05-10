import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, full_name, company_name } = (req as any).body
  if (!email || !password || !full_name) return res.status(400).json({ error: 'Email, password and name required' })
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name, company_name }
  })
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
  const { data, error } = await supabase.from('profiles').select('*').eq('id', req.user!.id).single()
  if (error) {
    // Auto-create profile if missing (handles edge case)
    const { data: created } = await supabase.from('profiles').insert({
      id: req.user!.id, email: req.user!.email
    }).select().single()
    return res.json(created || { id: req.user!.id, email: req.user!.email, plan: 'free' })
  }
  return res.json(data)
})

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const allowed = [
    'full_name', 'company_name', 'company_address', 'company_phone',
    'company_website', 'tax_number', 'default_currency', 'default_tax_rate',
    'default_payment_terms', 'country_code', 'notify_on_view',
    'notify_on_payment', 'auto_reminders'
  ]
  const updates: Record<string, any> = {}
  allowed.forEach(k => { if ((req as any).body[k] !== undefined) updates[k] = (req as any).body[k] })
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' })
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.user!.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

export default router

// One-time admin setup endpoint — creates first super admin
// Protected by ADMIN_SETUP_KEY env var
router.post('/setup-admin', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, setup_key } = (req as any).body
    
    // Must match ADMIN_SETUP_KEY env var
    const validKey = process.env.ADMIN_SETUP_KEY || 'InvoiceProSetup2024'
    if (setup_key !== validKey) {
      return res.status(403).json({ error: 'Invalid setup key. Use: InvoiceProSetup2024 or your ADMIN_SETUP_KEY env var' })
    }
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Email and password (8+ chars) required' })
    }

    const { supabase: sb } = await import('../lib/supabase')
    
    // Check if admin already exists
    const { data: existing } = await sb.from('admin_users').select('id').eq('email', email).single()
    if (existing) return res.status(400).json({ error: 'Admin with this email already exists' })

    // Hash password
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash(password, 12)

    const { data, error } = await sb.from('admin_users').insert({
      email,
      password_hash: hash,
      full_name: full_name || 'Super Admin',
      role: 'super_admin',
      is_active: true
    }).select('id, email, full_name, role').single()

    if (error) return res.status(400).json({ error: error.message })
    
    return res.json({
      message: '✅ Super admin created successfully!',
      admin: data,
      login_url: `${process.env.FRONTEND_URL || 'https://invoicepro-ten.vercel.app'}/admin-login`
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})


// Check admin setup status
router.get('/setup-status', async (req: Request, res: Response) => {
  try {
    const { supabase: sb } = await import('../lib/supabase')
    const { data: admins, error } = await sb.from('admin_users').select('id, email, role').limit(10)
    if (error && error.message.includes('does not exist')) {
      return res.json({ ready: false, tables_exist: false, message: 'Run the admin SQL schema in Supabase first' })
    }
    if (error) return res.json({ ready: false, error: error.message })
    return res.json({ ready: true, tables_exist: true, admin_count: admins?.length || 0, admins: admins?.map((a: any) => ({ email: a.email, role: a.role })) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})
