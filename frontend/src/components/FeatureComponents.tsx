import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, Star, DollarSign, Calendar, Gift, Camera, Plus, X, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'

// ── CASH FLOW FORECAST ────────────────────────────────────
export function CashFlowPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cashflow'], queryFn: () => api.get<any>('/features/cashflow') })
  const s = data?.summary || {}
  const weekly = data?.weekly || []

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Cash flow forecast</h1><p className="page-subtitle">Expected income for next 90 days</p></div>
      </div>
      <div className="page-body">
        {isLoading ? <div style={{ color: 'var(--text-subtle)' }}>Calculating forecast...</div> : (
          <>
            <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[['Next 30 days', s.next_30_days||0,'var(--green)'],['Next 60 days', s.next_60_days||0,'var(--blue)'],['Next 90 days', s.next_90_days||0,'var(--text)']].map(([label,val,color]:any) => (
                <div key={label} className="metric-card">
                  <div className="metric-label">{label}</div>
                  <div className="metric-value" style={{ color }}>{formatCurrency(val)}</div>
                  <div className="metric-sub">expected income</div>
                </div>
              ))}
            </div>
            <div className="card card-p" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Weekly forecast</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekly.slice(0,12)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => `W${v}`} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip contentStyle={{ background: '#1a1814', border: 'none', borderRadius: 8, color: 'white', fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), 'Expected']} labelFormatter={v => `Week ${v}`} />
                  <Bar dataKey="expected" fill="#1a1814" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Period</th><th>Expected</th><th>Invoices</th></tr></thead>
                <tbody>
                  {weekly.slice(0,8).map((w:any) => (
                    <tr key={w.week}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.label}</td>
                      <td><span className="currency-amount" style={{ color: w.expected > 0 ? 'var(--green)' : 'var(--text-subtle)' }}>{formatCurrency(w.expected)}</span></td>
                      <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{w.invoices.length} invoice{w.invoices.length !== 1 ? 's' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── CLIENT HAPPINESS ─────────────────────────────────────
export function HappinessPage() {
  const { data, isLoading } = useQuery({ queryKey: ['happiness'], queryFn: () => api.get<any>('/features/satisfaction/scores') })
  const scores = data?.scores || []
  const avg = data?.average || 0
  const nps = data?.nps || 0

  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Client happiness</h1><p className="page-subtitle">Track satisfaction after every paid invoice</p></div>
      </div>
      <div className="page-body">
        <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          <div className="metric-card">
            <div className="metric-label">Average score</div>
            <div className="metric-value" style={{ color: avg >= 4 ? 'var(--green)' : avg >= 3 ? 'var(--amber)' : 'var(--red)' }}>{avg.toFixed(1)}/5</div>
            <div style={{ color: '#f59e0b', marginTop: 4, fontSize: 16 }}>{stars(Math.round(avg))}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">NPS score</div>
            <div className="metric-value" style={{ color: nps > 0 ? 'var(--green)' : 'var(--red)' }}>{nps > 0 ? '+' : ''}{nps}</div>
            <div className="metric-sub">promoters minus detractors</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total responses</div>
            <div className="metric-value">{data?.total_responses || 0}</div>
            <div className="metric-sub">satisfaction surveys</div>
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoading ? <div className="empty-state">Loading...</div> : scores.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Star size={20} /></div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>No responses yet</div>
              <div style={{ fontSize: 13 }}>Go to a paid invoice and click "Send satisfaction survey" to start collecting feedback</div>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Client</th><th>Invoice</th><th>Score</th><th>Comment</th><th>Date</th></tr></thead>
              <tbody>
                {scores.map((s:any) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.clients?.name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{s.invoices?.invoice_number}</td>
                    <td><span style={{ color: '#f59e0b', fontSize: 16 }}>{stars(s.score)}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.comment || '—'}</td>
                    <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{formatDate(s.responded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

// ── INVOICE FINANCING ─────────────────────────────────────
type FinancingStep = 'loading' | 'unavailable' | 'status' | 'terms' | 'form' | 'confirm' | 'success'

export function FinancingWidget({ invoiceId, currency, onClose }: { invoiceId: string; invoiceTotal: number; currency: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<FinancingStep>('loading')
  const [form, setForm] = useState({ account_holder_name: '', bank_name: '', account_number: '', sort_code: '', contact_phone: '', business_registered_name: '' })
  const [application, setApplication] = useState<any>(null)
  const [quote, setQuote] = useState<any>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load quote + existing application on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [quoteRes, appRes] = await Promise.all([
          api.get<any>(`/features/financing/quote/${invoiceId}`).catch(() => null),
          api.get<any>(`/features/financing/application/${invoiceId}`).catch(() => ({ application: null })),
        ])
        if (cancelled) return
        if (!quoteRes) { setStep('unavailable'); return }
        setQuote(quoteRes)
        if (appRes?.application) { setApplication(appRes.application); setStep('status') }
        else setStep('terms')
      } catch { setStep('unavailable') }
    })()
    return () => { cancelled = true }
  }, [invoiceId])

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const res = await api.post<any>(`/features/financing/apply/${invoiceId}`, form)
      setApplication(res.application)
      setStep('success')
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
    } catch(e: any) {
      setError(e.message || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; title: string; desc: string }> = {
    pending:      { icon: '⏳', color: '#b45309', bg: '#fef9c3', title: 'Application submitted', desc: 'Our team will review your application within 2 business hours.' },
    under_review: { icon: '🔍', color: '#0369a1', bg: '#dbeafe', title: 'Under review', desc: 'Our financing team is reviewing your application now.' },
    approved:     { icon: '✅', color: '#15803d', bg: '#dcfce7', title: 'Approved!', desc: 'Your application is approved. Funds will be transferred to your bank account within 24 hours.' },
    funded:       { icon: '💰', color: '#15803d', bg: '#dcfce7', title: 'Funds sent!', desc: 'The advance has been deposited to your bank account. We will collect from your client on the due date.' },
    repaid:       { icon: '🎉', color: '#374151', bg: '#f3f4f6', title: 'Complete', desc: 'Your client has paid. The financing arrangement is now closed.' },
    rejected:     { icon: '❌', color: '#dc2626', bg: '#fee2e2', title: 'Not approved', desc: '' },
  }

  if (step === 'loading') return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>Calculating your advance...</div>
  )

  if (step === 'unavailable') return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>💼</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Invoice financing is not available for this invoice.</div>
      <button className="btn btn-sm btn-secondary" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
    </div>
  )

  // ── STATUS VIEW ───────────────────────────────────────────
  if (step === 'status' && application) {
    const cfg = STATUS_CONFIG[application.status] || STATUS_CONFIG.pending
    return (
      <div style={{ padding: 20 }}>
        <div style={{ background: cfg.bg, borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>{cfg.icon}</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: cfg.color, marginBottom: 4 }}>{cfg.title}</div>
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            {application.status === 'rejected' && application.rejection_reason ? application.rejection_reason : cfg.desc}
          </div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, fontSize: 12, marginBottom: 12 }}>
          {[
            ['Reference', application.reference],
            ['Invoice advance', formatCurrency(application.gross_advance, currency)],
            ['Service fee (' + application.fee_percent + '%)', '-' + formatCurrency(application.fee_amount, currency)],
            ['Net advance', formatCurrency(application.net_advance, currency)],
            ['Bank account', application.bank_name + ' ···' + application.account_number.slice(-4)],
            ['Applied', new Date(application.applied_at || application.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>{l}</span><span style={{ fontWeight: 500, color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
        {application.status === 'rejected' && (
          <button className="btn btn-sm btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setApplication(null); setStep('terms') }}>
            Submit new application
          </button>
        )}
      </div>
    )
  }

  // ── SUCCESS ───────────────────────────────────────────────
  if (step === 'success' && application) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Application submitted!</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Reference: <strong>{application.reference}</strong><br/>
          We'll review and respond within 2 business hours. Check your email for confirmation.
        </div>
        <button className="btn btn-sm btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => setStep('status')}>
          View application status
        </button>
      </div>
    )
  }

  // ── TERMS (Step 1) ────────────────────────────────────────
  if (step === 'terms' && quote) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>You could receive today</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--green)', letterSpacing: '-0.03em' }}>{formatCurrency(quote.net_advance, currency)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>deposited within 24 hours of approval</div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          {[
            { label: 'Invoice total', value: formatCurrency(quote.invoice_amount, currency), color: '', bold: false, note: undefined },
            { label: 'We advance (90%)', value: formatCurrency(quote.gross_advance, currency), color: '', bold: false, note: undefined },
            { label: `Service fee (${quote.fee_percent}%)`, value: '-' + formatCurrency(quote.fee_amount, currency), color: 'var(--red)', bold: false, note: quote.days_overdue > 0 ? `Overdue tier — ${quote.fee_percent}%` : `Standard tier — ${quote.fee_percent}% (invoice not yet due)` },
            { label: 'You receive', value: formatCurrency(quote.net_advance, currency), color: 'var(--green)', bold: true, note: undefined },
          ].map(({ label, value, color, bold, note }, i) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', fontSize: 12.5, fontWeight: bold ? 700 : 400 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={color ? { color } : {}}>{value}</span>
              </div>
              {note && <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', paddingBottom: 4 }}>{note}</div>}
            </div>
          ))}
        </div>
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 11.5, color: '#92400e', lineHeight: 1.5 }}>
          <strong>How it works:</strong> We advance 90% of your invoice today. You pay a one-time {quote.fee_percent}% service fee. We collect the full invoice amount from your client on the due date — they don't know about this arrangement.
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 16px' }}
          onClick={() => setStep('form')}>
          Apply — get {formatCurrency(quote.net_advance, currency)} now
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 8 }}>No credit check · Decision in 2 hours · No hidden charges</div>
      </div>
    )
  }

  // ── FORM (Step 2) ─────────────────────────────────────────
  if (step === 'form') {
    const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setStep('terms')} style={{ padding: 4 }}>←</button>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Bank account details</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          We'll transfer {formatCurrency(quote?.net_advance || 0, currency)} to this account within 24 hours of approval.
        </div>
        {[
          { key: 'account_holder_name', label: 'Account holder name *', placeholder: 'Name as it appears on the account' },
          { key: 'bank_name', label: 'Bank name *', placeholder: 'e.g. HDFC Bank, Barclays, Chase' },
          { key: 'account_number', label: 'Account number *', placeholder: 'Your bank account number' },
          { key: 'sort_code', label: 'Sort code / IFSC / IBAN', placeholder: 'Sort code, IFSC, or IBAN (if applicable)' },
          { key: 'contact_phone', label: 'Contact phone *', placeholder: 'Your mobile number' },
          { key: 'business_registered_name', label: 'Registered business name', placeholder: 'Optional — your company\'s legal name' },
        ].map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
            <input
              className="form-input"
              placeholder={placeholder}
              value={(form as any)[key]}
              onChange={e => upd(key, e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>
        ))}
        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', marginTop: 4 }}
          onClick={() => {
            if (!form.account_holder_name.trim()) { setError('Account holder name is required'); return }
            if (!form.bank_name.trim()) { setError('Bank name is required'); return }
            if (!form.account_number.trim()) { setError('Account number is required'); return }
            if (!form.contact_phone.trim()) { setError('Contact phone is required'); return }
            setError(''); setStep('confirm')
          }}>
          Review &amp; confirm →
        </button>
      </div>
    )
  }

  // ── CONFIRM (Step 3) ──────────────────────────────────────
  if (step === 'confirm' && quote) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setStep('form')} style={{ padding: 4 }}>←</button>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Confirm application</div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Financing offer</div>
          {[
            ['Net advance to you', formatCurrency(quote.net_advance, currency)],
            ['Service fee', formatCurrency(quote.fee_amount, currency) + ' (' + quote.fee_percent + '%)'],
            ['Funding time', 'Within 24 hours of approval'],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>{l}</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Bank account</div>
          {[
            ['Account holder', form.account_holder_name],
            ['Bank', form.bank_name],
            ['Account number', '···' + form.account_number.slice(-4)],
            ...(form.sort_code ? [['Sort code / IFSC', form.sort_code]] : []),
            ['Phone', form.contact_phone],
            ...(form.business_registered_name ? [['Business name', form.business_registered_name]] : []),
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>{l}</span><span style={{ fontWeight: 500, color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 16px' }}
          onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting...' : `Submit application for ${formatCurrency(quote.net_advance, currency)}`}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 8 }}>
          By submitting you agree to the financing terms. Your client will be unaware of this arrangement.
        </div>
      </div>
    )
  }

  return null
}

// ── YEAR IN REVIEW ────────────────────────────────────────
export function YearReviewPage() {
  const year = new Date().getFullYear() - 1
  const { data, isLoading } = useQuery({ queryKey: ['year-review', year], queryFn: () => api.get<any>(`/features/year-review/${year}`) })

  if (isLoading) return (
    <>
      <div className="page-header"><div><h1 className="page-title">Year in review</h1></div></div>
      <div className="page-body" style={{ color: 'var(--text-subtle)' }}>Loading your {year} highlights...</div>
    </>
  )

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">{year} — Your year in review</h1><p className="page-subtitle">A look back at your business performance</p></div>
      </div>
      <div className="page-body">
        <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[['Total revenue', formatCurrency(data?.total_revenue||0),'var(--green)'],['Net profit', formatCurrency(data?.net_profit||0),(data?.net_profit||0)>=0?'var(--green)':'var(--red)'],['Invoices created', data?.invoices_created||0,'var(--text)'],['Invoices paid', data?.invoices_paid||0,'var(--green)'],['Total expenses', formatCurrency(data?.total_expenses||0),'var(--red)'],['Clients', data?.new_clients||0,'var(--blue)']].map(([label,val,color]:any) => (
            <div key={label} className="metric-card">
              <div className="metric-label">{label}</div>
              <div className="metric-value" style={{ color, fontSize: 22 }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {data?.best_month && (
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Best month</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.best_month.month}</div>
              <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 4 }}>{formatCurrency(data.best_month.amount)}</div>
            </div>
          )}
          {data?.top_client && (
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top client</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{data.top_client.name}</div>
              <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 4 }}>{formatCurrency(data.top_client.amount)}</div>
            </div>
          )}
          {data?.top_expense_category && (
            <div className="card card-p" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Biggest expense</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{data.top_expense_category.category}</div>
              <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 4 }}>{formatCurrency(data.top_expense_category.amount)}</div>
            </div>
          )}
        </div>
        {data?.monthly_breakdown?.length > 0 && (
          <div className="card card-p">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Monthly revenue breakdown</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.monthly_breakdown} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(0,3)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip contentStyle={{ background: '#1a1814', border: 'none', borderRadius: 8, color: 'white', fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), 'Revenue']} />
                <Bar dataKey="amount" fill="#a3e635" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  )
}

// ── RECEIPT SCANNER ───────────────────────────────────────
export function ReceiptScanner({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      setPreview(ev.target?.result as string)
      setScanning(true)
      try {
        const data = await api.post<any>('/features/scan-receipt', { image_base64: base64, media_type: file.type })
        setResult(data)
        if (data.expense_id) { toast.success('Expense created from receipt!'); onSave() }
      } catch (err: any) {
        toast.error('Failed to scan receipt')
      } finally { setScanning(false) }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Camera size={18} /> Scan receipt with AI</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: 24 }}>
          {!preview ? (
            <div style={{ border: '2px dashed var(--border-strong)', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
              <Camera size={32} style={{ color: 'var(--text-subtle)', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Upload a receipt photo</div>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>AI will extract merchant, amount, date and category automatically</div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            </div>
          ) : (
            <div>
              <img src={preview} alt="Receipt" style={{ width: '100%', borderRadius: 8, marginBottom: 16, maxHeight: 200, objectFit: 'contain' }} />
              {scanning ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                  <Zap size={20} style={{ margin: '0 auto 8px', color: '#b45309' }} />
                  <div>AI is reading your receipt...</div>
                </div>
              ) : result?.extracted && (
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Extracted data:</div>
                  {Object.entries(result.extracted).filter(([k]) => !['error'].includes(k)).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k.replace('_', ' ')}</span>
                      <span style={{ fontWeight: 500 }}>{String(v)}</span>
                    </div>
                  ))}
                  {result.expense_id && <div style={{ color: 'var(--green)', fontWeight: 600, marginTop: 12, fontSize: 13 }}>✓ Expense saved automatically</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MILESTONE BILLING ─────────────────────────────────────
export function MilestoneBillingModal({ clients, onClose, onSave }: { clients: any[]; onClose: () => void; onSave: () => void }) {
  const [projectName, setProjectName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [clientId, setClientId] = useState('')
  const [milestones, setMilestones] = useState([{ name: 'Project kickoff', percent: 25, due_date: '' }, { name: 'Mid-project delivery', percent: 50, due_date: '' }, { name: 'Final delivery', percent: 25, due_date: '' }])
  const [loading, setLoading] = useState(false)

  const totalPercent = milestones.reduce((s, m) => s + m.percent, 0)

  const submit = async () => {
    if (!projectName || !totalAmount || !clientId) return toast.error('Fill in all required fields')
    if (totalPercent !== 100) return toast.error('Milestone percentages must add up to 100%')
    setLoading(true)
    try {
      await api.post('/features/milestones', { client_id: clientId, project_name: projectName, total_amount: parseFloat(totalAmount), milestones })
      toast.success(`${milestones.length} milestone invoices created!`)
      onSave()
    } catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 540 }}>
        <div className="modal-header"><h2 style={{ fontSize: 17, fontWeight: 700 }}>Milestone billing</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Project name *</label><input className="form-input" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Website redesign" /></div>
            <div className="form-group"><label className="form-label">Total project value *</label><input className="form-input" type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="5000" /></div>
            <div className="form-group"><label className="form-label">Client *</label><select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Select client...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="form-label" style={{ margin: 0 }}>Milestones <span style={{ color: totalPercent === 100 ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>({totalPercent}% total)</span></label>
              <button className="btn btn-sm btn-secondary" onClick={() => setMilestones([...milestones, { name: '', percent: 0, due_date: '' }])}><Plus size={12} /> Add</button>
            </div>
            {milestones.map((m, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 130px 32px', gap: 8, marginBottom: 8 }}>
                <input className="form-input" placeholder="Milestone name" value={m.name} onChange={e => { const n = [...milestones]; n[i].name = e.target.value; setMilestones(n) }} />
                <input className="form-input" type="number" placeholder="%" value={m.percent} onChange={e => { const n = [...milestones]; n[i].percent = parseInt(e.target.value)||0; setMilestones(n) }} />
                <input className="form-input" type="date" value={m.due_date} onChange={e => { const n = [...milestones]; n[i].due_date = e.target.value; setMilestones(n) }} />
                <button className="btn btn-ghost btn-icon" onClick={() => setMilestones(milestones.filter((_,j) => j !== i))} disabled={milestones.length <= 1}><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Creating...' : `Create ${milestones.length} invoices`}</button></div>
      </div>
    </div>
  )
}
