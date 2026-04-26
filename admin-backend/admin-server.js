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
  try { await supabase.from('admin_audit_log').insert({ admin_id: adminId, action, entity_type: entityType, entity_id: String(entityId || ''), new_value: meta }) } catch(e) {}
}

// ── LOGIN ────────────────────────────────────────────────
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const { data: admin } = await supabase.from('admin_users').select('*').eq('email', email).eq('is_active', true).single()
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
    await supabase.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', admin.id)
    const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.ADMIN_JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token, admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role } })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── DASHBOARD STATS ──────────────────────────────────────
app.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const [usersRes, invoicesRes, paymentsRes, ticketsRes, satisfactionRes, clientsRes] = await Promise.all([
      supabase.from('profiles').select('id, plan, created_at'),
      supabase.from('invoices').select('id, total, status, created_at'),
      supabase.from('payments').select('amount, paid_at').gte('paid_at', new Date(Date.now() - 30*864e5).toISOString()),
      supabase.from('support_tickets').select('id, status'),
      supabase.from('satisfaction_scores').select('score'),
      supabase.from('clients').select('id, created_at')
    ])
    const users = usersRes.data || []
    const invoices = invoicesRes.data || []
    const payments = paymentsRes.data || []
    const scores = satisfactionRes.data || []
    const planBreakdown = {}
    users.forEach(u => { const p = u.plan || 'free'; planBreakdown[p] = (planBreakdown[p] || 0) + 1 })
    const mrr = (planBreakdown.starter||0)*9 + (planBreakdown.pro||0)*19 + (planBreakdown.enterprise||0)*49
    const avgSat = scores.length ? (scores.reduce((s,r) => s + r.score, 0) / scores.length).toFixed(1) : 0
    const thirtyDaysAgo = new Date(Date.now() - 30*864e5).toISOString()
    return res.json({
      total_users: users.length, new_users_30d: users.filter(u => u.created_at > thirtyDaysAgo).length,
      total_invoices: invoices.length, paid_invoices: invoices.filter(i => i.status === 'paid').length,
      total_revenue: invoices.filter(i => i.status === 'paid').reduce((s,i) => s + i.total, 0),
      revenue_30d: payments.reduce((s,p) => s + p.amount, 0),
      mrr, arr: mrr * 12,
      open_tickets: (ticketsRes.data || []).filter(t => t.status === 'open').length,
      avg_satisfaction: avgSat, plan_breakdown: planBreakdown,
      total_clients: (clientsRes.data || []).length,
      overdue_invoices: invoices.filter(i => i.status === 'overdue').length
    })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── USERS ────────────────────────────────────────────────
app.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const { search, plan, page = 1, limit = 25 } = req.query
    let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
    if (plan) query = query.eq('plan', plan)
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count, page: +page, limit: +limit })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.get('/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const [profileRes, invoicesRes, clientsRes, expensesRes, quotesRes, paymentsRes, scoresRes, teamRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', req.params.id).single(),
      supabase.from('invoices').select('*, clients(name)').eq('user_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('clients').select('*').eq('user_id', req.params.id).eq('is_archived', false),
      supabase.from('expenses').select('*').eq('user_id', req.params.id).order('date', { ascending: false }).limit(20),
      supabase.from('quotes').select('*, clients(name)').eq('user_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('user_id', req.params.id).order('paid_at', { ascending: false }),
      supabase.from('satisfaction_scores').select('*, clients(name)').eq('user_id', req.params.id),
      supabase.from('team_members').select('*').eq('owner_id', req.params.id)
    ])
    const invoices = invoicesRes.data || []
    const payments = paymentsRes.data || []
    const scores = scoresRes.data || []
    return res.json({
      profile: profileRes.data, invoices, clients: clientsRes.data || [],
      expenses: expensesRes.data || [], quotes: quotesRes.data || [],
      payments, satisfaction: scores, team: teamRes.data || [],
      stats: {
        total_invoices: invoices.length, paid_invoices: invoices.filter(i => i.status === 'paid').length,
        overdue_invoices: invoices.filter(i => i.status === 'overdue').length,
        total_revenue: invoices.filter(i => i.status === 'paid').reduce((s,i) => s + i.total, 0),
        total_clients: (clientsRes.data || []).length,
        total_expenses: (expensesRes.data || []).reduce((s,e) => s + e.amount, 0),
        avg_satisfaction: scores.length ? (scores.reduce((s,r) => s + r.score, 0) / scores.length).toFixed(1) : null
      }
    })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const allowed = ['full_name','company_name','company_address','company_phone','tax_number','default_currency','default_tax_rate','default_payment_terms','plan']
    const updates = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'user_updated', 'user', req.params.id, updates)
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/users/:id/plan', adminAuth, async (req, res) => {
  try {
    const { plan } = req.body
    const { data, error } = await supabase.from('profiles').update({ plan }).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'plan_changed', 'user', req.params.id, { plan })
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/users/:id/suspend', adminAuth, async (req, res) => {
  try {
    const { suspended } = req.body
    await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: suspended ? '876600h' : 'none' })
    await log(req.admin.id, suspended ? 'user_suspended' : 'user_unsuspended', 'user', req.params.id, {})
    return res.json({ message: suspended ? 'User suspended' : 'User unsuspended' })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/users/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const { password } = req.body
    await supabase.auth.admin.updateUserById(req.params.id, { password })
    await log(req.admin.id, 'password_reset', 'user', req.params.id, {})
    return res.json({ message: 'Password reset successfully' })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.delete('/admin/users/:id', adminAuth, async (req, res) => {
  try {
    await supabase.auth.admin.deleteUser(req.params.id)
    await log(req.admin.id, 'user_deleted', 'user', req.params.id, {})
    return res.json({ message: 'User deleted permanently' })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── USER CLIENTS (admin can manage any user's clients) ───
app.get('/admin/users/:userId/clients', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('clients').select('*').eq('user_id', req.params.userId).order('name')
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data || [])
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.post('/admin/users/:userId/clients', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('clients').insert({ ...req.body, user_id: req.params.userId }).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'client_created', 'client', data.id, { user_id: req.params.userId })
    return res.status(201).json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/clients/:id', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('clients').update(req.body).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'client_updated', 'client', req.params.id, req.body)
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.delete('/admin/clients/:id', adminAuth, async (req, res) => {
  try {
    await supabase.from('clients').update({ is_archived: true }).eq('id', req.params.id)
    await log(req.admin.id, 'client_deleted', 'client', req.params.id, {})
    return res.json({ message: 'Client archived' })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── ALL CLIENTS (platform-wide) ──────────────────────────
app.get('/admin/clients', adminAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 25 } = req.query
    let query = supabase.from('clients').select('*, profiles(full_name, company_name)', { count: 'exact' }).eq('is_archived', false).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── INVOICES (admin can manage any invoice) ──────────────
app.get('/admin/invoices', adminAuth, async (req, res) => {
  try {
    const { status, user_id, search, page = 1, limit = 25 } = req.query
    let query = supabase.from('invoices').select('*, profiles(full_name, company_name, email), clients(name)', { count: 'exact' }).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
    if (status) query = query.eq('status', status)
    if (user_id) query = query.eq('user_id', user_id)
    if (search) query = query.ilike('invoice_number', `%${search}%`)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count, page: +page })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/invoices/:id', adminAuth, async (req, res) => {
  try {
    const allowed = ['status','due_date','notes','total','tax_rate','tax_amount','discount_percent','discount_amount']
    const updates = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
    if (updates.status === 'paid' && !req.body.paid_at) updates.paid_at = new Date().toISOString()
    const { data, error } = await supabase.from('invoices').update(updates).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'invoice_updated', 'invoice', req.params.id, updates)
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.delete('/admin/invoices/:id', adminAuth, async (req, res) => {
  try {
    await supabase.from('invoices').delete().eq('id', req.params.id)
    await log(req.admin.id, 'invoice_deleted', 'invoice', req.params.id, {})
    return res.json({ message: 'Invoice deleted' })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── EXPENSES ─────────────────────────────────────────────
app.get('/admin/expenses', adminAuth, async (req, res) => {
  try {
    const { user_id, page = 1, limit = 25 } = req.query
    let query = supabase.from('expenses').select('*, profiles(full_name, company_name)', { count: 'exact' }).order('date', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
    if (user_id) query = query.eq('user_id', user_id)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── PAYMENTS ─────────────────────────────────────────────
app.get('/admin/payments', adminAuth, async (req, res) => {
  try {
    const { user_id, page = 1, limit = 25 } = req.query
    let query = supabase.from('payments').select('*, profiles(full_name, company_name), invoices(invoice_number)', { count: 'exact' }).order('paid_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
    if (user_id) query = query.eq('user_id', user_id)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── QUOTES ───────────────────────────────────────────────
app.get('/admin/quotes', adminAuth, async (req, res) => {
  try {
    const { user_id, status, page = 1, limit = 25 } = req.query
    let query = supabase.from('quotes').select('*, profiles(full_name, company_name), clients(name)', { count: 'exact' }).order('created_at', { ascending: false }).range((+page-1)*+limit, +page*+limit-1)
    if (user_id) query = query.eq('user_id', user_id)
    if (status) query = query.eq('status', status)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ data, total: count })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── PLANS ────────────────────────────────────────────────
app.get('/admin/plans', adminAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('plans').select('*').order('sort_order')
    return res.json(data || [])
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/plans/:id', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('plans').update(req.body).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'plan_updated', 'plan', req.params.id, req.body)
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── FEATURE FLAGS ────────────────────────────────────────
app.get('/admin/feature-flags', adminAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('app_settings').select('*').like('key', 'feature_%')
    return res.json(data || [])
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/feature-flags/:key', adminAuth, async (req, res) => {
  try {
    const { value } = req.body
    const { data, error } = await supabase.from('app_settings').upsert({ key: req.params.key, value: JSON.stringify(value), category: 'features' }).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'feature_flag_updated', 'setting', req.params.key, { value })
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── SATISFACTION ─────────────────────────────────────────
app.get('/admin/satisfaction', adminAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('satisfaction_scores').select('*, profiles(full_name, company_name), clients(name)').order('responded_at', { ascending: false }).limit(200)
    const scores = data || []
    const avg = scores.length ? (scores.reduce((s,r) => s + r.score, 0) / scores.length).toFixed(1) : 0
    const dist = [1,2,3,4,5].map(n => ({ score: n, count: scores.filter(s => s.score === n).length }))
    return res.json({ scores, average: avg, total: scores.length, distribution: dist })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── SUPPORT TICKETS ──────────────────────────────────────
app.get('/admin/tickets', adminAuth, async (req, res) => {
  try {
    const { status } = req.query
    let query = supabase.from('support_tickets').select('*, profiles(full_name, email, plan)').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data } = await query
    return res.json(data || [])
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/tickets/:id', adminAuth, async (req, res) => {
  try {
    const { admin_reply, status, priority } = req.body
    const updates = { status: status || 'resolved', replied_at: new Date().toISOString() }
    if (admin_reply) updates.admin_reply = admin_reply
    if (priority) updates.priority = priority
    const { data, error } = await supabase.from('support_tickets').update(updates).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'ticket_replied', 'ticket', req.params.id, { status })
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── CURRENCIES ───────────────────────────────────────────
app.get('/admin/currencies', adminAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('currencies').select('*').order('sort_order')
    return res.json(data || [])
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/currencies/:code', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('currencies').update(req.body).eq('code', req.params.code).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── APP SETTINGS ─────────────────────────────────────────
app.get('/admin/settings', adminAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('app_settings').select('*').order('category')
    return res.json(data || [])
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/settings', adminAuth, async (req, res) => {
  try {
    for (const item of req.body) {
      await supabase.from('app_settings').upsert({ key: item.key, value: JSON.stringify(item.value) })
    }
    await log(req.admin.id, 'settings_updated', 'settings', 'global', {})
    return res.json({ message: 'Settings saved' })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── BROADCAST ────────────────────────────────────────────
app.post('/admin/broadcast', adminAuth, async (req, res) => {
  try {
    const { subject, message, plan_filter } = req.body
    let query = supabase.from('profiles').select('email, full_name')
    if (plan_filter) query = query.eq('plan', plan_filter)
    const { data: users } = await query
    await log(req.admin.id, 'broadcast_sent', 'broadcast', 'all', { subject, recipient_count: users?.length })
    return res.json({ message: `Broadcast queued for ${users?.length || 0} users`, recipients: users?.length || 0 })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── REVENUE ANALYTICS ────────────────────────────────────
app.get('/admin/revenue', adminAuth, async (req, res) => {
  try {
    const { data: payments } = await supabase.from('payments').select('amount, paid_at').order('paid_at', { ascending: false })
    const all = payments || []
    const monthly = {}
    all.forEach(p => { const m = new Date(p.paid_at).toISOString().slice(0,7); monthly[m] = (monthly[m] || 0) + p.amount })
    const { data: profiles } = await supabase.from('profiles').select('plan, created_at').order('created_at')
    const growth = {}
    if (profiles) profiles.forEach(p => { const m = new Date(p.created_at).toISOString().slice(0,7); growth[m] = (growth[m] || 0) + 1 })
    return res.json({ monthly_revenue: monthly, user_growth: growth, total_processed: all.reduce((s,p) => s + p.amount, 0) })
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── FINANCING ────────────────────────────────────────────
app.get('/admin/financing', adminAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('activity_logs').select('*, profiles(full_name, company_name, email)').eq('action', 'financing_applied').order('created_at', { ascending: false })
    return res.json(data || [])
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.put('/admin/financing/:id/status', adminAuth, async (req, res) => {
  try {
    const { status, note } = req.body
    const { data, error } = await supabase.from('activity_logs').update({ metadata: { status, note, updated_at: new Date().toISOString() } }).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    await log(req.admin.id, 'financing_status_updated', 'financing', req.params.id, { status })
    return res.json(data)
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

// ── AUDIT LOG ────────────────────────────────────────────
app.get('/admin/audit', adminAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('admin_audit_log').select('*, admin_users(email, full_name)').order('created_at', { ascending: false }).limit(200)
    return res.json(data || [])
  } catch(e) { return res.status(500).json({ error: e.message }) }
})

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'InvoicePro Admin v3', timestamp: new Date().toISOString() }))
app.listen(PORT, () => { console.log('🔐 InvoicePro Admin v3 on port ' + PORT) })
