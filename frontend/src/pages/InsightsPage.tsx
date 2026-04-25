import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Zap, Target } from 'lucide-react'

export default function InsightsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<any>('/dashboard/overview')
  })

  const s = data?.summary || {}

  const paymentRate = s.payment_rate || 0
  const overdueAmount = s.total_overdue || 0
  const totalBilled = s.total_billed || 0
  const netProfit = s.net_profit || 0

  // Calculate health score (0-100)
  const healthScore = Math.min(100, Math.round(
    (paymentRate * 0.4) +
    (overdueAmount === 0 ? 30 : overdueAmount < totalBilled * 0.1 ? 20 : 10) +
    (netProfit > 0 ? 30 : 10)
  ))

  const scoreColor = healthScore >= 80 ? '#16a34a' : healthScore >= 60 ? '#b45309' : '#dc2626'
  const scoreLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs attention'

  const insights = [
    paymentRate >= 80 ? { type: 'good', icon: CheckCircle, text: `Your payment rate is ${paymentRate}% — well above average. Clients are paying reliably.` } : { type: 'warn', icon: AlertCircle, text: `Your payment rate is ${paymentRate}%. Send reminders earlier to improve this.` },
    overdueAmount > 0 ? { type: 'bad', icon: TrendingDown, text: `You have ${formatCurrency(overdueAmount)} overdue. Consider adding late payment fees to encourage faster payment.` } : { type: 'good', icon: CheckCircle, text: 'No overdue invoices — excellent cash flow management!' },
    netProfit > 0 ? { type: 'good', icon: TrendingUp, text: `Your net profit is ${formatCurrency(netProfit)}. Keep tracking expenses to maximise this.` } : { type: 'warn', icon: AlertCircle, text: 'Your expenses exceed revenue this period. Review your costs.' },
    s.invoice_count < 5 ? { type: 'tip', icon: Zap, text: 'Tip: Set up recurring invoices for regular clients to save time and ensure consistent cash flow.' } : null,
    s.client_count < 3 ? { type: 'tip', icon: Target, text: 'Tip: Diversify your client base. Having 3+ active clients reduces income risk significantly.' } : null,
  ].filter(Boolean) as any[]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business insights</h1>
          <p className="page-subtitle">Your financial health at a glance</p>
        </div>
      </div>

      <div className="page-body">
        {isLoading ? <div style={{ color: 'var(--text-subtle)' }}>Analysing your business...</div> : (
          <>
            {/* Health Score */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 20 }}>
              <div className="card card-p" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)', marginBottom: 16 }}>Business health score</div>
                <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 16px' }}>
                  <svg viewBox="0 0 140 140" width="140" height="140">
                    <circle cx="70" cy="70" r="60" fill="none" stroke="var(--border)" strokeWidth="10" />
                    <circle cx="70" cy="70" r="60" fill="none" stroke={scoreColor} strokeWidth="10"
                      strokeDasharray={`${(healthScore / 100) * 377} 377`}
                      strokeLinecap="round"
                      transform="rotate(-90 70 70)" />
                    <text x="70" y="65" textAnchor="middle" style={{ fontSize: 32, fontWeight: 800, fill: scoreColor, fontFamily: 'DM Sans' }}>{healthScore}</text>
                    <text x="70" y="85" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--text-subtle)', fontFamily: 'DM Sans' }}>/100</text>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor, marginBottom: 6 }}>{scoreLabel}</div>
                <div style={{ fontSize: 12, color: 'var(--text-subtle)', lineHeight: 1.5 }}>Based on payment rate, overdue amounts and profit margin</div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Key metrics</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Payment rate', `${paymentRate}%`, paymentRate >= 80 ? 'var(--green)' : 'var(--amber)'],
                    ['Total billed', formatCurrency(totalBilled), 'var(--text)'],
                    ['Net profit', formatCurrency(netProfit), netProfit >= 0 ? 'var(--green)' : 'var(--red)'],
                    ['Overdue', formatCurrency(overdueAmount), overdueAmount > 0 ? 'var(--red)' : 'var(--green)'],
                    ['Active clients', s.client_count || 0, 'var(--text)'],
                    ['Total invoices', s.invoice_count || 0, 'var(--text)'],
                  ].map(([label, value, color]) => (
                    <div key={label as string} className="metric-card" style={{ padding: 14 }}>
                      <div className="metric-label">{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: color as string }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="card card-p" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Zap size={16} color="#b45309" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Smart recommendations</span>
              </div>
              {insights.map((insight, i) => {
                const Icon = insight.icon
                const colors = { good: ['var(--green-bg)', 'var(--green)'], warn: ['var(--amber-bg)', 'var(--amber)'], bad: ['var(--red-bg)', 'var(--red)'], tip: ['var(--blue-bg)', 'var(--blue)'] }
                const [bg, color] = colors[insight.type as keyof typeof colors] || colors.tip
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: bg, borderRadius: 10, marginBottom: 10 }}>
                    <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{insight.text}</span>
                  </div>
                )
              })}
            </div>

            {/* Tips section */}
            <div className="card card-p">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Quick wins to improve your score</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { num: '01', title: 'Enable Stripe payments', desc: 'Businesses with online payment links get paid 3x faster on average.' },
                  { num: '02', title: 'Set up auto-reminders', desc: 'Automated reminders reduce late payments by up to 60%.' },
                  { num: '03', title: 'Send quotes before invoices', desc: 'Agreed quotes mean fewer payment disputes and faster approval.' },
                ].map(({ num, title, desc }) => (
                  <div key={num} style={{ padding: 16, background: 'var(--bg)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', marginBottom: 8, fontFamily: 'monospace' }}>{num}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
