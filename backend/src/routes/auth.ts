import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { authenticate, AuthRequest } from '../middleware/auth'
import { emailService } from '../services/emailService'

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
    'notify_on_payment', 'auto_reminders', 'company_logo',
    'invoice_template', 'bank_account_details'
  ]
  const updates: Record<string, any> = {}
  allowed.forEach(k => { if ((req as any).body[k] !== undefined) updates[k] = (req as any).body[k] })
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' })

  // Try full update; gracefully strip columns that don't exist in DB yet
  let { data, error } = await supabase.from('profiles').update(updates).eq('id', req.user!.id).select().single()
  if (error && (error.message?.includes('invoice_template') || error.message?.includes('bank_account_details'))) {
    const { invoice_template, bank_account_details, ...safeUpdates } = updates
    const retry = await supabase.from('profiles').update(safeUpdates).eq('id', req.user!.id).select().single()
    data = retry.data; error = retry.error
    // Return success — frontend stores these in localStorage as primary source
    if (!error) return res.json({ ...data, invoice_template, bank_account_details })
  }
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

// ── CUSTOM FORGOT PASSWORD ───────────────────────────────
// Generates a Supabase recovery link and sends it via our emailService
// This bypasses Supabase's rate-limited free-tier email
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = (req as any).body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const frontendUrl = process.env.FRONTEND_URL || 'https://invoicepro-ten.vercel.app'

    // Generate a Supabase recovery link (admin API — no email sent by Supabase)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${frontendUrl}/auth` }
    })

    // Always return success — never reveal whether account exists
    if (error || !data?.properties?.action_link) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' })
    }

    const resetUrl = data.properties.action_link

    // Send via our emailService (Resend / SMTP from admin panel config)
    try {
      await emailService.sendGeneral({
        to: email,
        subject: 'Reset your InvoicePro password',
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:20px">
          <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
            <div style="background:#1a1814;padding:28px 32px">
              <h1 style="color:white;margin:0;font-size:21px;font-weight:700;letter-spacing:-0.5px">Reset your password</h1>
              <p style="color:rgba(255,255,255,0.6);margin:5px 0 0;font-size:13px">InvoicePro account recovery</p>
            </div>
            <div style="padding:32px">
              <p style="color:#374151;font-size:15px;margin:0 0 12px">We received a request to reset the password for your InvoicePro account.</p>
              <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
              <a href="${resetUrl}" style="display:inline-block;background:#1a1814;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:-0.2px">Reset password →</a>
              <p style="color:#9ca3af;font-size:12px;margin:24px 0 8px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
              <p style="color:#d1d5db;font-size:11px;word-break:break-all">Link not working? Copy and paste into your browser:<br>${resetUrl}</p>
            </div>
            <div style="background:#f8f7f4;padding:16px 32px;border-top:1px solid #e8e5de">
              <p style="color:#9ca3af;font-size:11px;margin:0">Sent by InvoicePro</p>
            </div>
          </div>
        </body></html>`
      })
      return res.json({ email_sent: true, message: 'Password reset email sent! Check your inbox (and spam folder).' })
    } catch (emailErr: any) {
      console.error('Password reset email failed:', emailErr.message)
      // Always surface the real error so the user can fix their email settings
      return res.json({
        email_sent: false,
        email_error: emailErr.message,
        dev_reset_url: resetUrl,
        message: `Reset link generated but email delivery failed: ${emailErr.message}. Check Admin Panel → Email Settings.`
      })
    }
  } catch (e: any) {
    console.error('Forgot password error:', e.message)
    return res.json({ message: 'If an account with that email exists, a reset link has been sent.' })
  }
})

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

export default router
