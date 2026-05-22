import { Router, Response, Request } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { calculateTax } from '../lib/taxCalculator'

const router = Router()

// ── FEATURE 3: AI Receipt Scanner ────────────────────────
router.post('/scan-receipt', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { image_base64, media_type = 'image/jpeg' } = (req as any).body
    if (!image_base64) return res.status(400).json({ error: 'image_base64 is required' })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type, data: image_base64 } },
            { type: 'text', text: 'Extract expense data from this receipt. Return ONLY valid JSON with these fields: {"merchant":"string","amount":number,"currency":"GBP","date":"YYYY-MM-DD","category":"Software|Hardware|Travel|Meals|Office|Marketing|Other","description":"string"}. If you cannot read a field, use null. Date format must be YYYY-MM-DD.' }
          ]
        }]
      })
    })

    const data = await response.json() as any
    const text = data.content?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()

    let extracted: any = {}
    try { extracted = JSON.parse(clean) } catch { extracted = { error: 'Could not parse receipt' } }

    // Auto-create expense if data is valid
    if (extracted.merchant && extracted.amount && !extracted.error) {
      const { data: expense } = await supabase.from('expenses').insert({
        user_id: (req as any).user!.id,
        category: extracted.category || 'Other',
        description: extracted.description || extracted.merchant,
        amount: extracted.amount,
        currency: extracted.currency || 'GBP',
        date: extracted.date || new Date().toISOString().split('T')[0],
        ai_scanned: true,
        receipt_data: extracted
      }).select().single()

      return res.json({ extracted, expense_id: expense?.id, message: 'Expense created from receipt!' })
    }

    return res.json({ extracted })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Receipt scanning failed' })
  }
})

// ── FEATURE 4: Cash Flow Forecast ────────────────────────
router.get('/cashflow', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user!.id
    const now = new Date()
    const in90 = new Date(now); in90.setDate(in90.getDate() + 90)

    const [invoicesRes, paymentsRes] = await Promise.all([
      supabase.from('invoices').select('*, clients(name)').eq('user_id', userId)
        .not('status', 'in', '("paid","cancelled")').lte('due_date', in90.toISOString().split('T')[0]),
      supabase.from('payments').select('amount, paid_at').eq('user_id', userId)
        .gte('paid_at', new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString())
    ])

    const upcoming = invoicesRes.data || []
    const payments = paymentsRes.data || []

    // Calculate avg payment time from historical data
    const avgDaysToPayment = 18 // Default estimate

    // Build 90-day forecast
    const forecast: Record<string, { expected: number; invoices: any[] }> = {}
    for (let i = 0; i <= 90; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i)
      const key = d.toISOString().split('T')[0]
      forecast[key] = { expected: 0, invoices: [] }
    }

    upcoming.forEach(inv => {
      const dueKey = inv.due_date
      if (forecast[dueKey]) {
        // Weight by likelihood of payment on time
        const isOverdue = new Date(inv.due_date) < now
        const probability = isOverdue ? 0.6 : 0.85
        forecast[dueKey].expected += inv.total * probability
        forecast[dueKey].invoices.push({ number: inv.invoice_number, client: inv.clients?.name, amount: inv.total, status: inv.status })
      }
    })

    // Group by week
    const weekly = []
    for (let w = 0; w < 13; w++) {
      const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() + w * 7)
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
      let weekTotal = 0
      const weekInvoices: any[] = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart); day.setDate(day.getDate() + d)
        const key = day.toISOString().split('T')[0]
        if (forecast[key]) { weekTotal += forecast[key].expected; weekInvoices.push(...forecast[key].invoices) }
      }
      weekly.push({
        week: w + 1,
        label: `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        expected: Math.round(weekTotal),
        invoices: weekInvoices
      })
    }

    const total30 = weekly.slice(0, 4).reduce((s, w) => s + w.expected, 0)
    const total60 = weekly.slice(0, 8).reduce((s, w) => s + w.expected, 0)
    const total90 = weekly.reduce((s, w) => s + w.expected, 0)

    return res.json({ weekly, summary: { next_30_days: Math.round(total30), next_60_days: Math.round(total60), next_90_days: Math.round(total90), pending_invoices: upcoming.length } })
  } catch (err) {
    return res.status(500).json({ error: 'Cash flow forecast failed' })
  }
})

// ── FEATURE 6: Client Happiness Score ────────────────────
router.post('/satisfaction/send/:invoiceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice, error: survInvErr } = await supabase.from('invoices').select(`*, clients(*)`).eq('id', (req as any).params.invoiceId).eq('user_id', (req as any).user!.id).single()
    if (survInvErr || !invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (invoice.status !== 'paid') return res.status(400).json({ error: 'Can only send satisfaction survey for paid invoices' })
    // Fetch profile separately to avoid cross-schema join issues
    const { data: survProfile } = await supabase.from('profiles').select('company_name, full_name').eq('id', (req as any).user!.id).single()

    const token = Buffer.from(`${invoice.id}:${Date.now()}`).toString('base64url')
    const surveyUrl = `${process.env.FRONTEND_URL}/satisfaction/${token}`
    const companyName = survProfile?.company_name || survProfile?.full_name || 'us'

    // Store token
    await supabase.from('invoices').update({ client_token: token }).eq('id', invoice.id)

    // Send email (simple version)
    try {
      const { emailService } = await import('../services/emailService')
      await emailService.sendSatisfactionSurvey({ to: invoice.clients.email, clientName: invoice.clients.name, companyName, surveyUrl, invoiceNumber: invoice.invoice_number })
    } catch(emailErr) { console.log('Survey email not sent:', emailErr) }

    return res.json({ message: 'Satisfaction survey sent!', survey_url: surveyUrl })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send survey' })
  }
})

router.post('/satisfaction/respond/:token', async (req: Request, res: Response) => {
  try {
    const { score, comment } = (req as any).body // score 1-5
    const { data: invoice } = await supabase.from('invoices').select('*').eq('client_token', (req as any).params.token).single()
    if (!invoice) return res.status(404).json({ error: 'Survey not found' })

    await supabase.from('satisfaction_scores').upsert({
      invoice_id: invoice.id, user_id: invoice.user_id,
      client_id: invoice.client_id, score, comment,
      responded_at: new Date().toISOString()
    })

    return res.json({ message: 'Thank you for your feedback!' })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record response' })
  }
})

router.get('/satisfaction/scores', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabase.from('satisfaction_scores').select(`*, clients(name), invoices(invoice_number)`).eq('user_id', (req as any).user!.id).order('responded_at', { ascending: false })
    const scores = data || []
    const avg = scores.length > 0 ? scores.reduce((s, r) => s + r.score, 0) / scores.length : 0
    const nps = scores.filter(s => s.score >= 4).length - scores.filter(s => s.score <= 2).length
    return res.json({ scores, average: Math.round(avg * 10) / 10, nps, total_responses: scores.length })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch scores' })
  }
})

// ── FEATURE 7: Invoice Financing ─────────────────────────
router.get('/financing/quote/:invoiceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice } = await supabase.from('invoices').select(`*, clients(*)`).eq('id', (req as any).params.invoiceId).eq('user_id', (req as any).user!.id).single()
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' })

    // Always recalculate the correct invoice total — never trust stored value
    // (handles invoices created before the tax-on-taxable-amount fix)
    const taxResult = calculateTax(
      invoice.subtotal || 0,
      invoice.discount_percent || 0,
      invoice.tax_rate || 0,
      invoice.country_code || 'GB',
      invoice.tax_type || 'CGST_SGST'
    )
    const correctTotal = taxResult.total + (invoice.late_fee_amount || 0)

    if (correctTotal < 500) return res.status(400).json({ error: 'Minimum invoice amount is £500 for financing' })

    // Fee tier based on how overdue the invoice is
    const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000))
    const feePercent = daysOverdue > 30 ? 4.5 : daysOverdue > 0 ? 3.5 : 2.5
    const feeLabel = daysOverdue > 30
      ? 'Early repayment fee (30+ days overdue tier)'
      : daysOverdue > 0
        ? 'Early repayment fee (overdue tier)'
        : 'Early repayment fee (standard tier)'

    const advancePercent = 0.90
    const r = (n: number) => Math.round(n * 100) / 100
    const grossAdvance = r(correctTotal * advancePercent)
    const feeAmount = r(grossAdvance * (feePercent / 100))
    const netAdvance = r(grossAdvance - feeAmount)

    return res.json({
      invoice_id: invoice.id,
      invoice_amount: r(correctTotal),
      advance_percent: advancePercent * 100,
      gross_advance: grossAdvance,
      fee_percent: feePercent,
      fee_amount: feeAmount,
      fee_label: feeLabel,
      net_advance: netAdvance,
      currency: invoice.currency,
      days_overdue: daysOverdue,
      estimated_funding: '24 hours',
      message: `Get ${netAdvance} ${invoice.currency} today instead of waiting`
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to calculate financing quote' })
  }
})

router.post('/financing/apply/:invoiceId', authenticate, async (req: AuthRequest, res: Response) => {
  const { account_holder_name, bank_name, account_number, sort_code, contact_phone, business_registered_name } = (req as any).body
  // Validate required fields
  if (!account_holder_name?.trim()) return res.status(400).json({ error: 'Account holder name is required' })
  if (!bank_name?.trim()) return res.status(400).json({ error: 'Bank name is required' })
  if (!account_number?.trim()) return res.status(400).json({ error: 'Account number is required' })
  if (!contact_phone?.trim()) return res.status(400).json({ error: 'Contact phone is required' })

  const invoice = await supabase.from('invoices').select('*, clients(*)').eq('id', (req as any).params.invoiceId).eq('user_id', (req as any).user!.id).single()
  if (!invoice.data) return res.status(404).json({ error: 'Invoice not found' })
  if (invoice.data.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' })

  // Check no existing active application
  const existing = await supabase.from('financing_applications')
    .select('id, status').eq('invoice_id', (req as any).params.invoiceId).eq('user_id', (req as any).user!.id)
    .not('status', 'eq', 'rejected').single()
  if (existing.data) return res.status(400).json({ error: 'An application already exists for this invoice', application: existing.data })

  // Recalculate offer
  const taxResult = calculateTax(invoice.data.subtotal || 0, invoice.data.discount_percent || 0, invoice.data.tax_rate || 0, invoice.data.country_code || 'GB', invoice.data.tax_type || 'CGST_SGST')
  const correctTotal = taxResult.total + (invoice.data.late_fee_amount || 0)
  const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.data.due_date).getTime()) / 86400000))
  const feePercent = daysOverdue > 30 ? 4.5 : daysOverdue > 0 ? 3.5 : 2.5
  const grossAdvance = Math.round(correctTotal * 0.90 * 100) / 100
  const feeAmount = Math.round(grossAdvance * (feePercent / 100) * 100) / 100
  const netAdvance = Math.round((grossAdvance - feeAmount) * 100) / 100

  // Generate reference
  const reference = 'FA-' + Date.now().toString(36).toUpperCase()

  const { data: application, error } = await supabase.from('financing_applications').insert({
    user_id: (req as any).user!.id,
    invoice_id: invoice.data.id,
    reference,
    invoice_amount: Math.round(correctTotal * 100) / 100,
    advance_percent: 90,
    gross_advance: grossAdvance,
    fee_percent: feePercent,
    fee_amount: feeAmount,
    net_advance: netAdvance,
    currency: invoice.data.currency || 'GBP',
    account_holder_name: account_holder_name.trim(),
    bank_name: bank_name.trim(),
    account_number: account_number.trim(),
    sort_code: sort_code?.trim() || null,
    contact_phone: contact_phone.trim(),
    business_registered_name: business_registered_name?.trim() || null,
    status: 'pending',
  }).select().single()

  if (error) {
    // If table doesn't exist yet (migration not run), return helpful message
    if (error.message?.includes('does not exist')) {
      return res.status(503).json({ error: 'Financing table not set up. Run the financing_migration.sql in Supabase SQL editor.' })
    }
    return res.status(400).json({ error: error.message })
  }

  // Send confirmation email
  try {
    const { emailService } = await import('../services/emailService')
    const { data: profile } = await supabase.from('profiles').select('full_name, company_name').eq('id', (req as any).user!.id).single()
    await emailService.sendFinancingApplicationReceived({
      to: (req as any).user!.email || '',
      name: profile?.company_name || profile?.full_name || 'there',
      reference,
      invoiceNumber: invoice.data.invoice_number,
      netAdvance,
      currency: invoice.data.currency || 'GBP',
    })
  } catch(e) { console.error('Financing email failed:', e) }

  return res.status(201).json({ message: 'Application submitted successfully', application, reference })
})

// GET /features/financing/application/:invoiceId — get status of application for an invoice
router.get('/financing/application/:invoiceId', authenticate, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('financing_applications')
    .select('*').eq('invoice_id', (req as any).params.invoiceId).eq('user_id', (req as any).user!.id)
    .order('created_at', { ascending: false }).limit(1).single()
  if (error || !data) return res.json({ application: null })
  return res.json({ application: data })
})

// GET /features/financing/applications — list all user applications
router.get('/financing/applications', authenticate, async (req: AuthRequest, res: Response) => {
  const { data } = await supabase.from('financing_applications')
    .select('*, invoices(invoice_number, due_date)')
    .eq('user_id', (req as any).user!.id)
    .order('created_at', { ascending: false })
  return res.json(data || [])
})

// ── FEATURE 9: Milestone Billing ──────────────────────────
router.post('/milestones', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, project_name, total_amount, currency = 'GBP', milestones } = (req as any).body
    // milestones: [{ name, percent, due_date }]
    if (!milestones?.length) return res.status(400).json({ error: 'milestones array required' })

    const created = []
    const { data: profile } = await supabase.from('profiles').select('default_tax_rate, default_currency').eq('id', (req as any).user!.id).single()

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i]
      const amount = total_amount * (m.percent / 100)
      const taxRate = profile?.default_tax_rate || 20
      const taxAmount = amount * (taxRate / 100)
      const total = amount + taxAmount

      const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', (req as any).user!.id)
      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`

      const { data: invoice } = await supabase.from('invoices').insert({
        user_id: (req as any).user!.id, client_id,
        invoice_number: invoiceNumber, status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: m.due_date, currency,
        subtotal: amount, tax_rate: taxRate, tax_amount: taxAmount,
        discount_percent: 0, discount_amount: 0, total,
        notes: `${project_name} — Milestone ${i + 1}: ${m.name} (${m.percent}%)`
      }).select().single()

      if (invoice) {
        await supabase.from('invoice_items').insert({
          invoice_id: invoice.id, description: `${project_name} — ${m.name}`,
          quantity: 1, unit_price: amount, tax_rate: 0, amount, sort_order: 0
        })
        created.push(invoice)
      }
    }

    return res.status(201).json({ message: `${created.length} milestone invoices created`, invoices: created })
  } catch (err) {
    return res.status(500).json({ error: 'Milestone creation failed' })
  }
})

// ── FEATURE 10: Early Payment Discount ────────────────────
router.post('/early-payment/:invoiceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { discount_percent = 2, discount_days = 5 } = (req as any).body
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', (req as any).params.invoiceId).eq('user_id', (req as any).user!.id).single()
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    const discountAmount = invoice.subtotal * (discount_percent / 100)
    const discountedTotal = invoice.total - discountAmount
    const discountDeadline = new Date()
    discountDeadline.setDate(discountDeadline.getDate() + discount_days)

    const updatedNotes = `${invoice.notes || ''}\n\nEARLY PAYMENT DISCOUNT: Pay by ${discountDeadline.toLocaleDateString('en-GB')} and save ${discount_percent}% (${invoice.currency} ${discountAmount.toFixed(2)}). Discounted total: ${invoice.currency} ${discountedTotal.toFixed(2)}`

    const { data, error } = await supabase.from('invoices').update({
      discount_percent, discount_amount: discountAmount,
      total: discountedTotal, notes: updatedNotes.trim()
    }).eq('id', (req as any).params.invoiceId).select().single()

    if (error) return res.status(400).json({ error: error.message })
    return res.json({ ...data, discount_deadline: discountDeadline.toISOString(), savings: discountAmount })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add early payment discount' })
  }
})

// ── FEATURE 11: Invoice View Tracking ─────────────────────
router.post('/track-view/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { source = 'link' } = (req as any).body
    await supabase.from('invoice_views').insert({
      invoice_id: (req as any).params.invoiceId,
      ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'],
      source,
      viewed_at: new Date().toISOString()
    })
    // Update view count using raw increment
    const { data: curr } = await supabase.from('invoices').select('view_count').eq('id', (req as any).params.invoiceId).single()
    await supabase.from('invoices')
      .update({ view_count: (curr?.view_count || 0) + 1, viewed_at: new Date().toISOString() })
      .eq('id', (req as any).params.invoiceId)
    return res.json({ tracked: true })
  } catch (err) {
    return res.json({ tracked: false })
  }
})

// ── FEATURE 12: Annual Year in Review ─────────────────────
router.get('/year-review/:year', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const year = parseInt((req as any).params.year) || new Date().getFullYear() - 1
    const start = `${year}-01-01`
    const end = `${year}-12-31`

    const [invoicesRes, paymentsRes, expensesRes, clientsRes] = await Promise.all([
      supabase.from('invoices').select('*, clients(name)').eq('user_id', (req as any).user!.id).gte('created_at', start).lte('created_at', end),
      supabase.from('payments').select('amount, paid_at').eq('user_id', (req as any).user!.id).gte('paid_at', start).lte('paid_at', end),
      supabase.from('expenses').select('amount, category').eq('user_id', (req as any).user!.id).gte('date', start).lte('date', end),
      supabase.from('clients').select('id, name').eq('user_id', (req as any).user!.id)
    ])

    const invoices = invoicesRes.data || []
    const payments = paymentsRes.data || []
    const expenses = expensesRes.data || []

    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const netProfit = totalRevenue - totalExpenses
    const paidInvoices = invoices.filter(i => i.status === 'paid')

    // Best month
    const monthly: Record<string, number> = {}
    payments.forEach(p => {
      const month = new Date(p.paid_at).toLocaleString('default', { month: 'long' })
      monthly[month] = (monthly[month] || 0) + p.amount
    })
    const bestMonth = Object.entries(monthly).sort((a, b) => b[1] - a[1])[0]

    // Top client by revenue
    const clientRevenue: Record<string, number> = {}
    invoices.filter(i => i.status === 'paid').forEach(inv => {
      if (inv.clients?.name) clientRevenue[inv.clients.name] = (clientRevenue[inv.clients.name] || 0) + inv.total
    })
    const topClient = Object.entries(clientRevenue).sort((a, b) => b[1] - a[1])[0]

    // Top expense category
    const expCat: Record<string, number> = {}
    expenses.forEach(e => { expCat[e.category] = (expCat[e.category] || 0) + e.amount })
    const topCategory = Object.entries(expCat).sort((a, b) => b[1] - a[1])[0]

    return res.json({
      year,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      net_profit: Math.round(netProfit * 100) / 100,
      invoices_created: invoices.length,
      invoices_paid: paidInvoices.length,
      new_clients: clientsRes.data?.length || 0,
      best_month: bestMonth ? { month: bestMonth[0], amount: Math.round(bestMonth[1] * 100) / 100 } : null,
      top_client: topClient ? { name: topClient[0], amount: Math.round(topClient[1] * 100) / 100 } : null,
      top_expense_category: topCategory ? { category: topCategory[0], amount: Math.round(topCategory[1] * 100) / 100 } : null,
      monthly_breakdown: Object.entries(monthly).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))
    })
  } catch (err) {
    return res.status(500).json({ error: 'Year review failed' })
  }
})

export default router
