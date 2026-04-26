import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, AlertTriangle, Clock, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate, getStatusClass } from '../lib/utils'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<any>('/dashboard/overview') })
  if (isLoading) return <div className="page-body" style={{ paddingTop: 32, color: 'var(--text-subtle)' }}>Loading...</div>
  const s = data?.summary || {}
  const chart = data?.monthly_chart || []
  const overdue = data?.overdue_invoices || []

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Your business at a glance</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/invoices')}><Plus size={15} /> New invoice</button>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total billed', value: formatCurrency(s.total_billed||0), sub: `${s.invoice_count||0} invoices` },
            { label: 'Collected', value: formatCurrency(s.total_paid||0), color: 'var(--green)', sub: `${s.payment_rate||0}% rate`, icon: <TrendingUp size={14} /> },
            { label: 'Outstanding', value: formatCurrency(s.total_pending||0), color: 'var(--amber)', sub: 'Pending payment', icon: <Clock size={14} /> },
            { label: 'Overdue', value: formatCurrency(s.total_overdue||0), color: 'var(--red)', sub: 'Needs attention', icon: <AlertTriangle size={14} /> },
          ].map(({ label, value, sub, color, icon }) => (
            <div key={label} className="metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="metric-label">{label}</div>
                {icon && <div style={{ color: color || 'var(--text-subtle)' }}>{icon}</div>}
              </div>
              <div className="metric-value" style={color ? { color } : {}}>{value}</div>
              <div className="metric-sub">{sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card card-p">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Net profit</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: (s.net_profit||0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(s.net_profit||0)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 6 }}>Revenue minus expenses</div>
          </div>
          <div className="card card-p">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Invoice breakdown</div>
            {Object.entries(data?.status_breakdown || {}).map(([status, count]: any) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className={`badge ${getStatusClass(status)}`} style={{ minWidth: 70, justifyContent: 'center' }}>{status}</span>
                <div style={{ flex: 1, height: 5, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: s.invoice_count > 0 ? `${(count/s.invoice_count)*100}%` : '0%', background: status === 'paid' ? 'var(--green)' : status === 'overdue' ? 'var(--red)' : 'var(--border-strong)' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 20, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-p" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Revenue vs expenses — last 6 months</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1a1814" stopOpacity={0.12} /><stop offset="95%" stopColor="#1a1814" stopOpacity={0} /></linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dc2626" stopOpacity={0.08} /><stop offset="95%" stopColor="#dc2626" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v>=1000?`${(v/1000).toFixed(0)}k`:v}`} />
              <Tooltip contentStyle={{ background: '#1a1814', border: 'none', borderRadius: 8, color: 'white', fontSize: 12 }} formatter={(v: any, name: string) => [formatCurrency(v), name === 'revenue' ? 'Revenue' : 'Expenses']} />
              <Area type="monotone" dataKey="revenue" stroke="#1a1814" strokeWidth={2} fill="url(#rev)" />
              <Area type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} fill="url(#exp)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {overdue.length > 0 && (
          <div className="card" style={{ borderColor: '#fecaca', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color="var(--red)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Overdue invoices ({overdue.length})</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Due date</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {overdue.map((inv: any) => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                    <td style={{ color: 'var(--red)' }}>{formatDate(inv.due_date)}</td>
                    <td><span className="currency-amount">{formatCurrency(inv.total, inv.currency)}</span></td>
                    <td><button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); navigate(`/invoices/${inv.id}`) }}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
