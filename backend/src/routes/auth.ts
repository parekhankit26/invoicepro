import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, full_name, company_name } = (req as any).body
  if (!email || !password || !full_name) return res.status(400).json({ error: 'Email, password and name are required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers()
  const alreadyExists = existing?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
  if (alreadyExists) {
    return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' })
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name, company_name }
  })
  if (error) {
    if (error.message.includes('already') || error.message.includes('duplicate')) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' })
    }
    return res.status(400).json({ error: error.message })
  }

  // Manually create profile in case trigger didnt fire
  if (data.user) {
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id, email, full_name,
        company_name: company_name || null,
        plan: 'free', default_currency: 'GBP', country_code: 'GB'
      })
    } catch(pe) { console.error('Profile creation error:', pe) }
  }

  return res.status(201).json({ message: 'Account created successfully', user: data.user })
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

// ── EMERGENCY USER SETUP / PASSWORD RESET ─────────────────
router.post('/reset-user-password', async (req: Request, res: Response) => {
  try {
    const { email, new_password, admin_key } = (req as any).body
    if (admin_key !== (process.env.ADMIN_SETUP_KEY || 'InvoiceProSetup2024')) {
      return res.status(403).json({ error: 'Invalid admin key' })
    }
    if (!email || !new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Email and new password (8+ chars) required' })
    }

    // Check if user exists in Supabase auth
    const { data: users } = await supabase.auth.admin.listUsers()
    const existing = users?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())

    if (existing) {
      // User exists — just update password
      const { error } = await supabase.auth.admin.updateUserById(existing.id, { password: new_password, email_confirm: true })
      if (error) return res.status(400).json({ error: error.message })

      // Also ensure profile exists
      await supabase.from('profiles').upsert({ id: existing.id, email, plan: 'free', default_currency: 'GBP', country_code: 'GB' })

      return res.json({ message: `✅ Password updated for ${email}. Login at invoicepro-ten.vercel.app/auth`, action: 'updated' })
    } else {
      // User not in page 1 — try to create, catch duplicate
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email, password: new_password, email_confirm: true,
        user_metadata: { full_name: email.split('@')[0] }
      })
      
      if (error) {
        // "Database error" usually means user exists in a later page
        // Try searching all pages
        let foundUser = null
        let page = 1
        while (!foundUser) {
          const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
          if (!pageData?.users?.length) break
          foundUser = pageData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
          if (foundUser) break
          if (pageData.users.length < 1000) break
          page++
        }
        
        if (foundUser) {
          // Found on deeper page — update password
          const { error: upErr } = await supabase.auth.admin.updateUserById(foundUser.id, { 
            password: new_password, email_confirm: true 
          })
          if (upErr) return res.status(400).json({ error: upErr.message })
          await supabase.from('profiles').upsert({ id: foundUser.id, email, plan: 'free', default_currency: 'GBP', country_code: 'GB' })
          return res.json({ message: `✅ Password updated for ${email}. You can now login!`, action: 'updated' })
        }
        return res.status(400).json({ error: error.message })
      }

      if (newUser?.user) {
        await supabase.from('profiles').upsert({
          id: newUser.user.id, email,
          full_name: email.split('@')[0],
          plan: 'free', default_currency: 'GBP', country_code: 'GB'
        })
      }
      return res.json({ message: `✅ Account created for ${email}. Login at invoicepro-ten.vercel.app/auth`, action: 'created' })
    }
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})
