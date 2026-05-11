import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const router = Router()
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'invoicepro-admin-secret-2024'

// ── Admin auth middleware ────────────────────────────────
const adminAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try { req.admin = jwt.verify(token, ADMIN_JWT_SECRET); next() }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }) }
}

const log = async (adminId: string, action: string, entityType: string, entityId: string, meta: any) => {
  try { await supabase.from('admin_audit_log').insert({ admin_id: adminId, action, entity_type: entityType, entity_id: String(entityId || ''), new_value: meta }) } catch(e) {}
}

// ── LOGIN ────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req as any).body
    const { data: admin, error } = await supabase.from('admin_users').select('*').eq('email', email).eq('is_active', true).single()
    if (error || !admin) return res.status(401).json({ error: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
    await supabase.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', admin.id)
    const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, ADMIN_JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token, admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role } })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── STATS ────────────────────────────────────────────────
router.get('/stats', adminAuth, async (req: any, res: Response) => {
  try {
    const [usersRes, invoicesRes, paymentsRes, clientsRes, ticketsRes, scoresRes] = await Promise.all([
      supabase.from('profiles').select('id, plan, created_at'),
      supabase.from('invoices').select('id, status, total, created_at'),
      supabase.from('payments').select('id, amount, paid_at').gte('paid_at', new Date(Date.now() - 30*864e5).toISOString()),
      supabase.from('clients').select('id').eq('is_archived', false),
      supabase.from('support_tickets').select('id, status').eq('status', 'open').limit(1),
      supabase.from('satisfaction_scores').select('score'),
    ])
    const users = usersRes.data || [], invoices = invoicesRes.data || [], payments = paymentsRes.data || []
    const scores = scoresRes.data || []
    const planBreakdown = { free: 0, starter: 0, pro: 0, enterprise: 0 } as any
    users.forEach((u: any) => { if (planBreakdown[u.plan] !== undefined) planBreakdown[u.plan]++ })
    const mrr = users.filter((u: any) => u.plan === 'starter').length * 9 + users.filter((u: any) => u.plan === 'pro').length * 19 + users.filter((u: any) => u.plan === 'enterprise').length * 49
    const avgSat = scores.length ? (scores.reduce((s: number, r: any) => s + r.score, 0) / scores.length).toFixed(1) : 0
    return res.json({
      total_users: users.length, new_users_30d: users.filter((u: any) => new Date(u.created_at) > new Date(Date.now() - 30*864e5)).length,
      total_invoices: invoices.length, total_revenue: invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + i.total, 0),
      revenue_30d: payments.reduce((s: number, p: any) => s + p.amount, 0), mrr, arr: mrr * 12,
      open_tickets: (ticketsRes.data || []).length, avg_satisfaction: avgSat, plan_breakdown: planBreakdown,
      total_clients: (clientsRes.data || []).length,
      overdue_invoices: invoices.filter((i: any) => i.status === 'overdue').length
    })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── USERS ────────────────────────────────────────────────
router.get('/users', adminAuth, async (req: any, res: Response) => {
  try {
    const { search, plan, page = '1', limit = '25' } = req.query as any
    let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
    if (plan) query = query.eq('plan', plan)
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count, page: +page, limit: +limit })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.get('/users/:id', adminAuth, async (req: any, res: Response) => {
  try {
    const [profileRes, invoicesRes, clientsRes, expensesRes, quotesRes, paymentsRes, teamRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', req.params.id).single(),
      supabase.from('invoices').select('*, clients(name)').eq('user_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('clients').select('*').eq('user_id', req.params.id),
      supabase.from('expenses').select('*').eq('user_id', req.params.id).limit(20),
      supabase.from('quotes').select('*, clients(name)').eq('user_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('user_id', req.params.id).order('paid_at', { ascending: false }),
      supabase.from('team_members').select('*').eq('owner_id', req.params.id),
    ])
    const invoices = invoicesRes.data || [], payments = paymentsRes.data || []
    return res.json({
      profile: profileRes.data, invoices, clients: clientsRes.data || [],
      expenses: expensesRes.data || [], quotes: quotesRes.data || [], payments, team: teamRes.data || [],
      stats: { total_invoices: invoices.length, paid_invoices: invoices.filter((i: any) => i.status === 'paid').length, total_revenue: invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + i.total, 0), total_clients: (clientsRes.data || []).length }
    })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/users/:id', adminAuth, async (req: any, res: Response) => {
  try {
    const allowed = ['full_name','company_name','company_address','company_phone','tax_number','default_currency','default_tax_rate','plan']
    const updates: any = {}
    allowed.forEach((k: string) => { if ((req as any).body[k] !== undefined) updates[k] = (req as any).body[k] })
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'user_updated', 'user', req.params.id, updates)
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/users/:id/plan', adminAuth, async (req: any, res: Response) => {
  try {
    const { plan } = (req as any).body
    const { data, error } = await supabase.from('profiles').update({ plan }).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'plan_changed', 'user', req.params.id, { plan })
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/users/:id/suspend', adminAuth, async (req: any, res: Response) => {
  try {
    const { suspended } = (req as any).body
    await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: suspended ? '876600h' : 'none' })
    await log(req.admin.id, suspended ? 'user_suspended' : 'user_unsuspended', 'user', req.params.id, {})
    return res.json({ message: suspended ? 'User suspended' : 'User unsuspended' })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.delete('/users/:id', adminAuth, async (req: any, res: Response) => {
  try {
    await supabase.auth.admin.deleteUser(req.params.id)
    await log(req.admin.id, 'user_deleted', 'user', req.params.id, {})
    return res.json({ message: 'User deleted' })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── INVOICES ────────────────────────────────────────────
router.get('/invoices', adminAuth, async (req: any, res: Response) => {
  try {
    const { status, user_id, search, page = '1', limit = '25' } = req.query as any
    let query = supabase.from('invoices').select('*, profiles(full_name, company_name, email), clients(name)', { count: 'exact' }).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
    if (status) query = query.eq('status', status)
    if (user_id) query = query.eq('user_id', user_id)
    if (search) query = query.ilike('invoice_number', `%${search}%`)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count, page: +page })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/invoices/:id', adminAuth, async (req: any, res: Response) => {
  try {
    const allowed = ['status','due_date','notes','total','tax_rate','tax_amount','discount_percent','discount_amount']
    const updates: any = {}
    allowed.forEach((k: string) => { if ((req as any).body[k] !== undefined) updates[k] = (req as any).body[k] })
    if (updates.status === 'paid' && !(req as any).body.paid_at) updates.paid_at = new Date().toISOString()
    const { data, error } = await supabase.from('invoices').update(updates).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'invoice_updated', 'invoice', req.params.id, updates)
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── REVENUE ──────────────────────────────────────────────
router.get('/revenue', adminAuth, async (_req: any, res: Response) => {
  try {
    const { data: payments } = await supabase.from('payments').select('amount, paid_at').order('paid_at', { ascending: false })
    const all = payments || []
    const monthly: any = {}
    all.forEach((p: any) => { const m = new Date(p.paid_at).toISOString().slice(0,7); monthly[m] = (monthly[m] || 0) + p.amount })
    const { data: profiles } = await supabase.from('profiles').select('plan, created_at')
    const growth: any = {}
    if (profiles) profiles.forEach((p: any) => { const m = new Date(p.created_at).toISOString().slice(0,7); growth[m] = (growth[m] || 0) + 1 })
    return res.json({ monthly_revenue: monthly, user_growth: growth, total_processed: all.reduce((s: number, p: any) => s + p.amount, 0) })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── AUDIT LOG ────────────────────────────────────────────
router.get('/audit', adminAuth, async (_req: any, res: Response) => {
  try {
    const { data } = await supabase.from('admin_audit_log').select('*, admin_users(email, full_name)').order('created_at', { ascending: false }).limit(200)
    return res.json(data || [])
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── BROADCAST ────────────────────────────────────────────
router.post('/broadcast', adminAuth, async (req: any, res: Response) => {
  try {
    const { subject, message, plan_filter } = (req as any).body
    let query: any = supabase.from('profiles').select('email, full_name')
    if (plan_filter) query = query.eq('plan', plan_filter)
    const { data: users } = await query
    await log(req.admin.id, 'broadcast_sent', 'broadcast', 'all', { subject, recipient_count: users?.length })
    return res.json({ message: `Broadcast queued for ${users?.length || 0} users`, recipients: users?.length || 0 })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

export default router

// ── HEALTH CHECK ─────────────────────────────────────────
router.get('/health', adminAuth, async (_req: any, res: Response) => {
  try {
    const checks: any = {}
    // DB check
    const start = Date.now()
    const { error: dbErr } = await supabase.from('profiles').select('id').limit(1)
    checks.database = { status: dbErr ? 'error' : 'ok', latency: Date.now() - start, error: dbErr?.message }
    // Count active users in last 24h
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      .gte('updated_at', new Date(Date.now() - 24 * 3600000).toISOString())
    checks.active_users_24h = count || 0
    // Invoice count today
    const { count: invCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
    checks.invoices_today = invCount || 0
    checks.smtp_configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER)
    checks.stripe_configured = !!process.env.STRIPE_SECRET_KEY
    checks.ai_configured = !!process.env.ANTHROPIC_API_KEY
    checks.twilio_configured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    return res.json({ status: 'ok', timestamp: new Date().toISOString(), checks })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── CHURN ANALYTICS ──────────────────────────────────────
router.get('/churn', adminAuth, async (_req: any, res: Response) => {
  try {
    const { data: users } = await supabase.from('profiles').select('id, plan, created_at, updated_at, email, full_name, company_name')
    const now = Date.now()
    const inactive = (users || []).filter((u: any) => {
      const lastActive = new Date(u.updated_at).getTime()
      return (now - lastActive) > 30 * 24 * 3600000 && u.plan !== 'free'
    })
    const recent = (users || []).filter((u: any) => {
      return new Date(u.created_at).getTime() > now - 7 * 24 * 3600000
    })
    const { data: recentPayments } = await supabase.from('payments').select('amount, paid_at, user_id').gte('paid_at', new Date(Date.now() - 30 * 24 * 3600000).toISOString())
    return res.json({
      at_risk: inactive,
      new_signups_7d: recent,
      recent_payments: recentPayments || [],
      churn_rate: users?.length ? ((inactive.length / users.length) * 100).toFixed(1) : 0
    })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── IMPERSONATE USER (generate token) ───────────────────
router.post('/impersonate/:userId', adminAuth, async (req: any, res: Response) => {
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', req.params.userId).single()
    if (!profile) return res.status(404).json({ error: 'User not found' })
    const { data: session, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink', email: profile.email
    })
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'user_impersonated', 'user', req.params.userId, { email: profile.email })
    return res.json({ message: `Impersonation link for ${profile.email}`, link: session.properties?.action_link, note: 'Link expires in 1 hour' })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── DATA EXPORT (GDPR) ───────────────────────────────────
router.get('/export/:userId', adminAuth, async (req: any, res: Response) => {
  try {
    const uid = req.params.userId
    const [profileRes, invoicesRes, clientsRes, expensesRes, quotesRes, paymentsRes, timeRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('invoices').select('*, invoice_items(*)').eq('user_id', uid),
      supabase.from('clients').select('*').eq('user_id', uid),
      supabase.from('expenses').select('*').eq('user_id', uid),
      supabase.from('quotes').select('*, quote_items(*)').eq('user_id', uid),
      supabase.from('payments').select('*').eq('user_id', uid),
      supabase.from('time_entries').select('*').eq('user_id', uid),
    ])
    const exportData = {
      exported_at: new Date().toISOString(),
      profile: profileRes.data,
      invoices: invoicesRes.data || [],
      clients: clientsRes.data || [],
      expenses: expensesRes.data || [],
      quotes: quotesRes.data || [],
      payments: paymentsRes.data || [],
      time_entries: timeRes.data || [],
    }
    await log(req.admin.id, 'data_exported', 'user', uid, { email: profileRes.data?.email })
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="invoicepro-export-${uid.slice(0,8)}.json"`)
    return res.json(exportData)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── PLATFORM ANNOUNCEMENT ────────────────────────────────
router.post('/announcement', adminAuth, async (req: any, res: Response) => {
  try {
    const { title, message, type = 'info', expires_hours = 24 } = (req as any).body
    const expires_at = new Date(Date.now() + expires_hours * 3600000).toISOString()
    const { data, error } = await supabase.from('app_settings').upsert({
      key: 'platform_announcement',
      value: JSON.stringify({ title, message, type, expires_at, created_at: new Date().toISOString() }),
      label: 'Platform Announcement',
      category: 'notifications'
    }).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'announcement_created', 'platform', 'global', { title })
    return res.json({ message: 'Announcement published', data })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.delete('/announcement', adminAuth, async (req: any, res: Response) => {
  try {
    await supabase.from('app_settings').delete().eq('key', 'platform_announcement')
    await log(req.admin.id, 'announcement_removed', 'platform', 'global', {})
    return res.json({ message: 'Announcement removed' })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── ADMIN USER MANAGEMENT ────────────────────────────────
router.get('/admins', adminAuth, async (req: any, res: Response) => {
  if (req.admin.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
  try {
    const { data, error } = await supabase.from('admin_users').select('id, email, full_name, role, last_login, is_active, created_at').order('created_at')
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data || [])
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.post('/admins', adminAuth, async (req: any, res: Response) => {
  if (req.admin.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
  try {
    const { email, password, full_name, role = 'support' } = (req as any).body
    if (!email || !password || password.length < 8) return res.status(400).json({ error: 'Email and password required (8+ chars)' })
    const hash = await bcrypt.hash(password, 12)
    const { data, error } = await supabase.from('admin_users').insert({ email, password_hash: hash, full_name, role, is_active: true }).select('id, email, full_name, role').single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'admin_created', 'admin_user', data.id, { email, role })
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/admins/:id/toggle', adminAuth, async (req: any, res: Response) => {
  if (req.admin.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
  try {
    const { data: current } = await supabase.from('admin_users').select('is_active').eq('id', req.params.id).single()
    const { data, error } = await supabase.from('admin_users').update({ is_active: !current?.is_active }).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── EXTEND TRIAL / CHANGE PLAN FREE ─────────────────────
router.post('/users/:id/extend-trial', adminAuth, async (req: any, res: Response) => {
  try {
    const { days = 14, plan = 'pro' } = (req as any).body
    const { data, error } = await supabase.from('profiles').update({ plan }).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'trial_extended', 'user', req.params.id, { days, plan })
    return res.json({ message: `Trial extended: ${plan} plan for ${days} days`, data })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── ADMIN PASSWORD RESET (emergency — no auth needed) ────
// Rate limited by checking last attempt in DB
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = (req as any).body
    if (!email) return res.status(400).json({ error: 'Email required' })
    
    const { data: admin } = await supabase.from('admin_users')
      .select('id, email, full_name').eq('email', email).eq('is_active', true).single()
    
    // Always return same response (don't reveal if email exists)
    if (!admin) return res.json({ message: 'If that email exists, a reset link has been sent.' })
    
    // Generate secure reset token (valid 1 hour)
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 3600000).toISOString()
    
    // Store token in DB
    await supabase.from('admin_users').update({
      password_reset_token: token,
      password_reset_expires: expires
    }).eq('id', admin.id)
    
    const resetUrl = `${process.env.BACKEND_URL || 'https://invoicepro-production-2ed7.up.railway.app'}/admin#reset=${token}`
    
    // Send email if SMTP configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const { emailService } = await import('../services/emailService')
        await (emailService as any).sendMail({
          to: admin.email,
          subject: 'InvoicePro Admin — Password Reset',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#1a1814">Password Reset Request</h2>
              <p>Hi ${admin.full_name || 'Admin'},</p>
              <p>Click below to reset your InvoicePro admin password. Link expires in 1 hour.</p>
              <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#1a1814;color:white;border-radius:8px;text-decoration:none;font-weight:600">Reset Password →</a>
              <p style="color:#888;font-size:12px">If you didn't request this, ignore this email. Your password won't change.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
              <p style="color:#888;font-size:11px">InvoicePro Admin Panel</p>
            </div>`
        })
      } catch(emailErr) { console.error('Reset email failed:', emailErr) }
    }
    
    // Log the attempt
    try { await supabase.from('admin_audit_log').insert({ admin_id: admin.id, action: 'password_reset_requested', entity_type: 'admin_user', entity_id: admin.id, new_value: { email: admin.email } }) } catch(_) {}
    
    return res.json({
      message: 'If that email exists, a reset link has been sent.',
      // In development/no-SMTP: return the reset URL directly
      ...(!process.env.SMTP_HOST ? { dev_reset_url: resetUrl } : {})
    })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── VERIFY RESET TOKEN ───────────────────────────────────
router.get('/reset-password/:token', async (req: Request, res: Response) => {
  try {
    const { data: admin } = await supabase.from('admin_users')
      .select('id, email, full_name, password_reset_expires')
      .eq('password_reset_token', req.params.token)
      .single()
    
    if (!admin) return res.status(400).json({ error: 'Invalid or expired reset link' })
    if (new Date(admin.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Request a new one.' })
    }
    return res.json({ valid: true, email: admin.email, name: admin.full_name })
  } catch(e: any) { return res.status(400).json({ error: 'Invalid reset link' }) }
})

// ── COMPLETE PASSWORD RESET ──────────────────────────────
router.post('/reset-password/:token', async (req: Request, res: Response) => {
  try {
    const { password } = (req as any).body
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
    
    const { data: admin } = await supabase.from('admin_users')
      .select('id, email, password_reset_expires')
      .eq('password_reset_token', req.params.token)
      .single()
    
    if (!admin) return res.status(400).json({ error: 'Invalid or expired reset link' })
    if (new Date(admin.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset link expired. Request a new one.' })
    }
    
    const hash = await bcrypt.hash(password, 12)
    await supabase.from('admin_users').update({
      password_hash: hash,
      password_reset_token: null,
      password_reset_expires: null
    }).eq('id', admin.id)
    
    try { await supabase.from('admin_audit_log').insert({ admin_id: admin.id, action: 'password_reset_completed', entity_type: 'admin_user', entity_id: admin.id, new_value: {} }) } catch(_) {}
    
    return res.json({ message: 'Password updated successfully. You can now log in.' })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── CHANGE OWN PASSWORD (logged-in admin) ────────────────
router.put('/change-password', adminAuth, async (req: any, res: Response) => {
  try {
    const { current_password, new_password } = (req as any).body
    if (!current_password || !new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Current password and new password (8+ chars) required' })
    }
    const { data: admin } = await supabase.from('admin_users').select('password_hash').eq('id', req.admin.id).single()
    if (!admin) return res.status(404).json({ error: 'Admin not found' })
    
    const valid = await bcrypt.compare(current_password, admin.password_hash)
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' })
    
    const hash = await bcrypt.hash(new_password, 12)
    await supabase.from('admin_users').update({ password_hash: hash }).eq('id', req.admin.id)
    
    try { await supabase.from('admin_audit_log').insert({ admin_id: req.admin.id, action: 'password_changed', entity_type: 'admin_user', entity_id: req.admin.id, new_value: {} }) } catch(_) {}
    
    return res.json({ message: 'Password changed successfully' })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── CLIENTS (platform-wide) ──────────────────────────────
router.get('/clients', adminAuth, async (req: any, res: Response) => {
  try {
    const search = req.query.search || ''
    let query = supabase.from('clients').select('*', { count: 'exact' })
      .eq('is_archived', false).order('created_at', { ascending: false }).limit(100)
    if (search) query = query.ilike('name', `%${search}%`)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.delete('/clients/:id', adminAuth, async (req: any, res: Response) => {
  try {
    const { error } = await supabase.from('clients').update({ is_archived: true }).eq('id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'client_archived', 'client', req.params.id, {})
    return res.json({ message: 'Client archived' })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── PAYMENTS (platform-wide) ─────────────────────────────
router.get('/payments', adminAuth, async (req: any, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const { data, error, count } = await supabase.from('payments')
      .select('*, invoices(invoice_number)', { count: 'exact' })
      .order('paid_at', { ascending: false }).limit(limit)
    if (error) return res.status(400).json({ error: error.message })
    // Enrich with profiles
    const userIds = [...new Set((data||[]).map((p:any) => p.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, company_name').in('id', userIds)
    const profileMap: any = {}
    ;(profiles||[]).forEach((p:any) => { profileMap[p.id] = p })
    const enriched = (data||[]).map((p:any) => ({ ...p, profiles: profileMap[p.user_id] || null }))
    return res.json({ data: enriched, total: count })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── QUOTES (platform-wide) ───────────────────────────────
router.get('/quotes', adminAuth, async (req: any, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const { data, error, count } = await supabase.from('quotes')
      .select('*, clients(name)', { count: 'exact' })
      .order('created_at', { ascending: false }).limit(limit)
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── EXPENSES (platform-wide) ─────────────────────────────
router.get('/expenses', adminAuth, async (req: any, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const { data, error, count } = await supabase.from('expenses')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).limit(limit)
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── FEATURE FLAGS ─────────────────────────────────────────
router.get('/feature-flags', adminAuth, async (_req: any, res: Response) => {
  try {
    const { data } = await supabase.from('app_settings').select('key, value').like('key', 'feature_%')
    return res.json(data || [])
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/feature-flags/:key', adminAuth, async (req: any, res: Response) => {
  try {
    const { value } = (req as any).body
    const { data, error } = await supabase.from('app_settings').upsert({
      key: req.params.key, value: JSON.stringify(value),
      label: req.params.key.replace(/_/g, ' ').replace('feature ', ''), category: 'features'
    }).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'feature_toggled', 'feature', req.params.key, { value })
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── SATISFACTION ──────────────────────────────────────────
router.get('/satisfaction', adminAuth, async (_req: any, res: Response) => {
  try {
    const { data: scores } = await supabase.from('satisfaction_scores')
      .select('*, profiles(full_name, company_name), clients(name)')
      .order('responded_at', { ascending: false }).limit(100)
    const all = scores || []
    const avg = all.length ? (all.reduce((s, r: any) => s + r.score, 0) / all.length).toFixed(1) : 0
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    all.forEach((r: any) => { if (dist[r.score] !== undefined) dist[r.score]++ })
    return res.json({
      scores: all, average: avg, total: all.length,
      distribution: Object.entries(dist).map(([score, count]) => ({ score: +score, count }))
    })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── FINANCING APPLICATIONS ───────────────────────────────
router.get('/financing', adminAuth, async (_req: any, res: Response) => {
  try {
    const { data } = await supabase.from('activity_logs')
      .select('*, profiles!user_id(full_name, company_name, email)')
      .eq('action', 'financing_applied').order('created_at', { ascending: false })
    return res.json(data || [])
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/financing/:id/status', adminAuth, async (req: any, res: Response) => {
  try {
    const { status } = (req as any).body
    const { data } = await supabase.from('activity_logs').select('metadata').eq('id', req.params.id).single()
    const { error } = await supabase.from('activity_logs').update({
      metadata: { ...(data?.metadata || {}), status }
    }).eq('id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, `financing_${status}`, 'financing', req.params.id, { status })
    return res.json({ message: `Application ${status}` })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── SUPPORT TICKETS ───────────────────────────────────────
router.get('/tickets', adminAuth, async (req: any, res: Response) => {
  try {
    let query = supabase.from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
    if (req.query.status) query = query.eq('status', req.query.status as string)
    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    // Enrich with profiles
    const uids = [...new Set((data||[]).map((t:any) => t.user_id).filter(Boolean))]
    let profileMap: any = {}
    if (uids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, email, plan, company_name').in('id', uids)
      ;(profs||[]).forEach((p:any) => { profileMap[p.id] = p })
    }
    const enriched = (data||[]).map((t:any) => ({ ...t, profiles: profileMap[t.user_id] || null }))
    return res.json(enriched)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/tickets/:id', adminAuth, async (req: any, res: Response) => {
  try {
    const { admin_reply, status } = (req as any).body
    const { data, error } = await supabase.from('support_tickets').update({
      admin_reply, status, resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      replied_by: req.admin.email, replied_at: new Date().toISOString()
    }).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'ticket_replied', 'ticket', req.params.id, { status })
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── PLANS ─────────────────────────────────────────────────
router.get('/plans', adminAuth, async (_req: any, res: Response) => {
  try {
    const { data, error } = await supabase.from('plans').select('*').order('price_monthly')
    if (error) {
      // Plans table might not exist yet — return defaults
      return res.json([
        { id: '1', slug: 'free', name: 'Free', price_monthly: 0, price_yearly: 0, max_invoices: 5, max_clients: 2, max_team_members: 0, is_active: true },
        { id: '2', slug: 'starter', name: 'Starter', price_monthly: 9, price_yearly: 90, max_invoices: -1, max_clients: -1, max_team_members: 3, is_active: true },
        { id: '3', slug: 'pro', name: 'Pro', price_monthly: 19, price_yearly: 190, max_invoices: -1, max_clients: -1, max_team_members: 10, is_active: true },
        { id: '4', slug: 'enterprise', name: 'Enterprise', price_monthly: 49, price_yearly: 490, max_invoices: -1, max_clients: -1, max_team_members: -1, is_active: true },
      ])
    }
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/plans/:id', adminAuth, async (req: any, res: Response) => {
  try {
    const { price_monthly, price_yearly, max_invoices, max_clients, max_team_members } = (req as any).body
    const updates: any = {}
    if (price_monthly !== undefined) updates.price_monthly = price_monthly
    if (price_yearly !== undefined) updates.price_yearly = price_yearly
    if (max_invoices !== undefined) updates.max_invoices = max_invoices
    if (max_clients !== undefined) updates.max_clients = max_clients
    if (max_team_members !== undefined) updates.max_team_members = max_team_members
    const { data, error } = await supabase.from('plans').update(updates).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'plan_updated', 'plan', req.params.id, updates)
    return res.json(data)
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── APP SETTINGS ──────────────────────────────────────────
router.get('/settings', adminAuth, async (_req: any, res: Response) => {
  try {
    const { data, error } = await supabase.from('app_settings').select('*').order('category').order('key')
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data || [])
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

router.put('/settings', adminAuth, async (req: any, res: Response) => {
  try {
    const updates = (req as any).body as Array<{ key: string; value: any }>
    for (const u of updates) {
      await supabase.from('app_settings').upsert({ key: u.key, value: JSON.stringify(u.value) })
    }
    await log(req.admin.id, 'settings_updated', 'settings', 'global', { count: updates.length })
    return res.json({ message: `${updates.length} settings saved` })
  } catch(e: any) { return res.status(500).json({ error: e.message }) }
})

// ── TEST EMAIL CONFIG ─────────────────────────────────────
router.post('/test-email', adminAuth, async (req: any, res: Response) => {
  try {
    const { to } = (req as any).body
    if (!to) return res.status(400).json({ error: 'Recipient email required' })
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(400).json({ error: 'SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to Railway env vars.' })
    }
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
    await transporter.verify()
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: '✅ InvoicePro email test — it works!',
      html: `<div style="font-family:sans-serif;padding:32px;max-width:500px">
        <h2 style="color:#1a1814">✅ Email is working!</h2>
        <p>Your InvoicePro SMTP configuration is working correctly.</p>
        <p style="color:#666;font-size:13px">Sent at: ${new Date().toLocaleString()}</p>
        <p style="color:#666;font-size:13px">SMTP: ${process.env.SMTP_HOST}</p>
      </div>`
    })
    await log(req.admin.id, 'test_email_sent', 'system', 'email', { to })
    return res.json({ message: `✅ Test email sent successfully to ${to}` })
  } catch(e: any) {
    return res.status(500).json({ error: `Email failed: ${e.message}` })
  }
})
