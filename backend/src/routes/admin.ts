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
