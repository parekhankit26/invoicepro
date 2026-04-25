const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.admin' })

const app = express()
const PORT = process.env.ADMIN_PORT || 3002
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

app.use(cors({ origin: '*', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.static(path.join(__dirname, 'admin-frontend')))
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'admin-frontend', 'admin.html')))

const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try { req.admin = jwt.verify(token, process.env.ADMIN_JWT_SECRET); next() }
  catch { return res.status(401).json({ error: 'Invalid token' }) }
}

const log = async (adminId, action, entityType, entityId, meta) => {
  try { await supabase.from('admin_audit_log').insert({ admin_id: adminId, action, entity_type: entityType, entity_id: String(entityId || ''), new_value: meta }) } catch {}
}

// ── AUTH ─────────────────────────────────────────────────
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body
  const { data: admin } = await supabase.from('admin_users').select('*').eq('email', email).eq('is_active', true).single()
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' })
  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
  await supabase.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', admin.id)
  const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.ADMIN_JWT_SECRET, { expiresIn: '8h' })
  return res.json({ token, admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role } })
})

// ── DASHBOARD STATS ──────────────────────────────────────
app.get('/admin/stats', adminAuth, async (req, res) => {
  const [usersRes, invoicesRes, paymentsRes, ticketsRes, satisfactionRes, featureUsageRes] = await Promise.all([
    supabase.from('profiles').select('id, plan, created_at'),
    supabase.from('invoices').select('id, total, status, created_at'),
    supabase.from('payments').select('amount, paid_at').gte('paid_at', new Date(Date.now() - 30*864e5).toISOString()),
    supabase.from('support_tickets').select('id, status'),
    supabase.from('satisfaction_scores').select('score'),
    supabase.from('activity_logs').select('action').in('action', ['financing_applied', 'whatsapp_sent', 'receipt_scanned']).gte('created_at', new Date(Date.now() - 30*864e5).toISOString())
  ])

  const users = usersRes.data || []
  const invoices = invoicesRes.data || []
  const payments = paymentsRes.data || []
  const scores = satisfactionRes.data || []

  const planBreakdown = users.reduce((acc, u) => { acc[u.plan || 'free'] = (acc[u.plan || 'free'] || 0) + 1; return acc }, {})
  const mrr = users.filter(u => u.plan === 'starter').length * 9 + users.filter(u => u.plan === 'pro').length * 19 + users.filter(u => u.plan === 'enterprise').length * 49
  const avgSatisfaction = scores.length ? (scores.reduce((s, r) => s + r.score, 0) / scores.length).toFixed(1) : 0

  // New users last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30*864e5).toISOString()
  const newUsers = users.filter(u => u.created_at > thirtyDaysAgo).length

  return res.json({
    total_users: users.length,
    new_users_30d: newUsers,
    total_invoices: invoices.length,
    paid_invoices: invoices.filter(i => i.status === 'paid').length,
    total_revenue: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    revenue_30d: payments.reduce((s, p) => s + p.amount, 0),
    mrr,
    arr: mrr * 12,
    open_tickets: (ticketsRes.data || []).filter(t => t.status === 'open').length,
    avg_satisfaction: avgSatisfaction,
    plan_breakdown: planBreakdown,
    feature_usage_30d: featureUsageRes.data?.length || 0
  })
})

// ── USERS ─────────────────────────────────────────────────
app.get('/admin/users', adminAuth, async (req, res) => {
  const { search, plan, page = 1, limit = 25 } = req.query
  let query = supabase.from('profiles').select('*, auth_user:id', { count: 'exact' }).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
  if (plan) query = query.eq('plan', plan)
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`)
  const { data, error, count } = await query
  if (error) return res.status(400).json({ error: error.message })
  return res.json({ data, total: count, page: +page, limit: +limit })
})

app.get('/admin/users/:id', adminAuth, async (req, res) => {
  const [profileRes, invoicesRes, paymentsRes, satisfactionRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', req.params.id).single(),
    supabase.from('invoices').select('*').eq('user_id', req.params.id).order('created_at', { ascending: false }),
    supabase.from('payments').select('amount, paid_at').eq('user_id', req.params.id),
    supabase.from('satisfaction_scores').select('score').eq('user_id', req.params.id)
  ])
  const invoices = invoicesRes.data || []
  const payments = paymentsRes.data || []
  const scores = satisfactionRes.data || []
  return res.json({
    profile: profileRes.data,
    invoices,
    stats: {
      total_invoices: invoices.length,
      paid_invoices: invoices.filter(i => i.status === 'paid').length,
      total_revenue: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
      total_payments: payments.reduce((s, p) => s + p.amount, 0),
      avg_satisfaction: scores.length ? (scores.reduce((s, r) => s + r.score, 0) / scores.length).toFixed(1) : null
    }
  })
})

app.put('/admin/users/:id/plan', adminAuth, async (req, res) => {
  const { plan } = req.body
  const validPlans = ['free', 'starter', 'pro', 'enterprise']
  if (!validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan' })
  const { data, error } = await supabase.from('profiles').update({ plan }).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  await log(req.admin.id, 'plan_changed', 'user', req.params.id, { plan })
  return res.json(data)
})

app.put('/admin/users/:id/suspend', adminAuth, async (req, res) => {
  const { suspended } = req.body
  // Disable their auth in Supabase
  await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: suspended ? '876600h' : 'none' })
  await log(req.admin.id, suspended ? 'user_suspended' : 'user_unsuspended', 'user', req.params.id, {})
  return res.json({ message: suspended ? 'User suspended' : 'User unsuspended' })
})

app.delete('/admin/users/:id', adminAuth, async (req, res) => {
  await supabase.auth.admin.deleteUser(req.params.id)
  await log(req.admin.id, 'user_deleted', 'user', req.params.id, {})
  return res.json({ message: 'User deleted' })
})

// ── FEATURE FLAGS ─────────────────────────────────────────
app.get('/admin/feature-flags', adminAuth, async (req, res) => {
  const { data } = await supabase.from('app_settings').select('*').like('key', 'feature_%')
  return res.json(data || [])
})

app.put('/admin/feature-flags/:key', adminAuth, async (req, res) => {
  const { value } = req.body
  const { data, error } = await supabase.from('app_settings').upsert({ key: req.params.key, value: JSON.stringify(value), category: 'features' }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  await log(req.admin.id, 'feature_flag_updated', 'setting', req.params.key, { value })
  return res.json(data)
})

// ── PLANS ─────────────────────────────────────────────────
app.get('/admin/plans', adminAuth, async (req, res) => {
  const { data } = await supabase.from('plans').select('*').order('sort_order')
  return res.json(data || [])
})

app.post('/admin/plans', adminAuth, async (req, res) => {
  const { data, error } = await supabase.from('plans').insert(req.body).select().single()
  if (error) return res.status(400).json({ error: error.message })
  await log(req.admin.id, 'plan_created', 'plan', data.id, req.body)
  return res.status(201).json(data)
})

app.put('/admin/plans/:id', adminAuth, async (req, res) => {
  const { data, error } = await supabase.from('plans').update(req.body).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  await log(req.admin.id, 'plan_updated', 'plan', req.params.id, req.body)
  return res.json(data)
})

// ── INVOICES (all users) ──────────────────────────────────
app.get('/admin/invoices', adminAuth, async (req, res) => {
  const { status, user_id, page = 1, limit = 25 } = req.query
  let query = supabase.from('invoices').select(`*, profiles(full_name, company_name, email), clients(name)`, { count: 'exact' }).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
  if (status) query = query.eq('status', status)
  if (user_id) query = query.eq('user_id', user_id)
  const { data, error, count } = await query
  if (error) return res.status(400).json({ error: error.message })
  return res.json({ data, total: count, page: +page })
})

// ── SATISFACTION SCORES (all) ────────────────────────────
app.get('/admin/satisfaction', adminAuth, async (req, res) => {
  const { data } = await supabase.from('satisfaction_scores').select(`*, profiles(full_name, company_name), clients(name)`).order('responded_at', { ascending: false }).limit(100)
  const scores = data || []
  const avg = scores.length ? (scores.reduce((s, r) => s + r.score, 0) / scores.length).toFixed(1) : 0
  const dist = [1,2,3,4,5].map(n => ({ score: n, count: scores.filter(s => s.score === n).length }))
  return res.json({ scores, average: avg, total: scores.length, distribution: dist })
})

// ── AI USAGE STATS ────────────────────────────────────────
app.get('/admin/ai-usage', adminAuth, async (req, res) => {
  const { data } = await supabase.from('activity_logs').select('user_id, action, created_at, metadata').eq('action', 'ai_chat').order('created_at', { ascending: false }).limit(200)
  const usage = data || []
  const byUser: Record<string, number> = {}
  usage.forEach(u => { byUser[u.user_id] = (byUser[u.user_id] || 0) + 1 })
  return res.json({ total_requests: usage.length, unique_users: Object.keys(byUser).length, recent: usage.slice(0, 20) })
})

// ── FINANCING APPLICATIONS ────────────────────────────────
app.get('/admin/financing', adminAuth, async (req, res) => {
  const { data } = await supabase.from('activity_logs').select(`*, profiles(full_name, company_name, email)`).eq('action', 'financing_applied').order('created_at', { ascending: false })
  return res.json(data || [])
})

app.put('/admin/financing/:logId/status', adminAuth, async (req, res) => {
  const { status, note } = req.body
  const { data, error } = await supabase.from('activity_logs').update({ metadata: { status, note, updated_at: new Date().toISOString() } }).eq('id', req.params.logId).select().single()
  if (error) return res.status(400).json({ error: error.message })
  await log(req.admin.id, 'financing_status_updated', 'financing', req.params.logId, { status })
  return res.json(data)
})

// ── SUPPORT TICKETS ───────────────────────────────────────
app.get('/admin/tickets', adminAuth, async (req, res) => {
  const { status } = req.query
  let query = supabase.from('support_tickets').select(`*, profiles(full_name, email, plan)`).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data } = await query
  return res.json(data || [])
})

app.put('/admin/tickets/:id', adminAuth, async (req, res) => {
  const { admin_reply, status } = req.body
  const { data, error } = await supabase.from('support_tickets').update({ admin_reply, status: status || 'resolved', replied_at: new Date().toISOString() }).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  await log(req.admin.id, 'ticket_replied', 'ticket', req.params.id, { status })
  return res.json(data)
})

// ── CURRENCIES ────────────────────────────────────────────
app.get('/admin/currencies', adminAuth, async (req, res) => {
  const { data } = await supabase.from('currencies').select('*').order('sort_order')
  return res.json(data || [])
})

app.post('/admin/currencies', adminAuth, async (req, res) => {
  const { data, error } = await supabase.from('currencies').insert(req.body).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.status(201).json(data)
})

app.put('/admin/currencies/:code', adminAuth, async (req, res) => {
  const { data, error } = await supabase.from('currencies').update(req.body).eq('code', req.params.code).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

// ── APP SETTINGS & BRANDING ───────────────────────────────
app.get('/admin/settings', adminAuth, async (req, res) => {
  const { data } = await supabase.from('app_settings').select('*').order('category')
  return res.json(data || [])
})

app.put('/admin/settings', adminAuth, async (req, res) => {
  const updates = req.body // array of { key, value }
  const results = []
  for (const item of updates) {
    const { data } = await supabase.from('app_settings').upsert({ key: item.key, value: JSON.stringify(item.value) }).select().single()
    results.push(data)
  }
  await log(req.admin.id, 'settings_updated', 'settings', 'global', { keys: updates.map(u => u.key) })
  return res.json(results)
})

// ── ANNOUNCEMENT / BROADCAST ──────────────────────────────
app.post('/admin/broadcast', adminAuth, async (req, res) => {
  const { subject, message, plan_filter } = req.body
  // Get target users
  let query = supabase.from('profiles').select('email, full_name')
  if (plan_filter) query = query.eq('plan', plan_filter)
  const { data: users } = await query
  // Store broadcast (in production, queue emails)
  await supabase.from('app_settings').upsert({ key: 'last_broadcast', value: JSON.stringify({ subject, message, plan_filter, sent_at: new Date().toISOString(), recipient_count: users?.length || 0 }) })
  await log(req.admin.id, 'broadcast_sent', 'broadcast', 'all', { subject, recipient_count: users?.length })
  return res.json({ message: `Broadcast queued for ${users?.length || 0} users`, recipients: users?.length || 0 })
})

// ── AUDIT LOG ─────────────────────────────────────────────
app.get('/admin/audit', adminAuth, async (req, res) => {
  const { data } = await supabase.from('admin_audit_log').select(`*, admin_users(email, full_name)`).order('created_at', { ascending: false }).limit(100)
  return res.json(data || [])
})

// ── REVENUE ANALYTICS ─────────────────────────────────────
app.get('/admin/revenue', adminAuth, async (req, res) => {
  const { data: payments } = await supabase.from('payments').select('amount, paid_at, currency').order('paid_at', { ascending: false })
  const all = payments || []
  // Group by month
  const monthly: Record<string, number> = {}
  all.forEach(p => {
    const m = new Date(p.paid_at).toISOString().slice(0, 7)
    monthly[m] = (monthly[m] || 0) + p.amount
  })
  const { data: profiles } = await supabase.from('profiles').select('plan, created_at').order('created_at')
  const growth: Record<string, number> = {}
  profiles?.forEach(p => { const m = new Date(p.created_at).toISOString().slice(0, 7); growth[m] = (growth[m] || 0) + 1 })
  return res.json({ monthly_revenue: monthly, user_growth: growth, total_processed: all.reduce((s, p) => s + p.amount, 0) })
})

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'InvoicePro Admin v2', timestamp: new Date().toISOString() }))

app.listen(PORT, () => console.log(`🔐 InvoicePro Admin v2 running on port ${PORT}`))
