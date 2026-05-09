import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, AlertTriangle, Clock, Plus, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate, getStatusClass } from '../lib/utils'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<any>('/dashboard/overview') })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })

  if (isLoading) return <div className="page-body" style={{ paddingTop: 32, color: 'var(--text-subtle)' }}>Loading...</div>

  const s = data?.summary || {}
  const chart = data?.monthly_chart || []
  const overdue = data?.overdue_invoices || []
  const currency = profile?.default_currency || 'GBP'
  const fmt = (v: number) => formatCurrency(v, currency)

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Your business at a glance</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/invoices')}><Plus size={15} /> New invoice</button>
      </div>
      <div className="page-body">

        {/* KPI cards */}
        <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total billed',  value: fmt(s.total_billed||0),   sub: `${s.invoice_count||0} invoices`,      icon: null, color: undefined },
            { label: 'Collected',     value: fmt(s.total_paid||0),     sub: `${s.payment_rate||0}% collection`,    icon: <TrendingUp size={14}/>, color: 'var(--green)' },
            { label: 'Outstanding',   value: fmt(s.total_pending||0),  sub: 'Awaiting payment',                    icon: <Clock size={14}/>, color: 'var(--amber)' },
            { label: 'Overdue',       value: fmt(s.total_overdue||0),  sub: 'Needs attention',                     icon: <AlertTriangle size={14}/>, color: 'var(--red)' },
          ].map(({ label, value, sub, icon, color }) => (
            <div key={label} className="metric-card">
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <div className="metric-label">{label}</div>
                {icon && <div style={{ color: color || 'var(--text-subtle)' }}>{icon}</div>}
              </div>
              <div className="metric-value" style={color ? { color } : {}}>{value}</div>
              <div className="metric-sub">{sub}</div>
            </div>
          ))}
        </div>

        <div className="dash-mid-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          {/* Net profit */}
          <div className="card card-p">
            <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Net profit</div>
            <div style={{ fontSize:32, fontWeight:700, color:(s.net_profit||0)>=0?'var(--green)':'var(--red)' }}>{fmt(s.net_profit||0)}</div>
            <div style={{ fontSize:12, color:'var(--text-subtle)', marginTop:6 }}>Revenue minus all expenses</div>
            <div style={{ display:'flex', gap:16, marginTop:14 }}>
              <div><div style={{ fontSize:11, color:'var(--text-subtle)' }}>Revenue</div><div style={{ fontSize:15, fontWeight:600, color:'var(--green)' }}>{fmt(s.total_paid||0)}</div></div>
              <div><div style={{ fontSize:11, color:'var(--text-subtle)' }}>Expenses</div><div style={{ fontSize:15, fontWeight:600, color:'var(--red)' }}>{fmt(s.total_expenses||0)}</div></div>
              <div><div style={{ fontSize:11, color:'var(--text-subtle)' }}>Active clients</div><div style={{ fontSize:15, fontWeight:600 }}>{s.client_count||0}</div></div>
            </div>
          </div>

          {/* Invoice breakdown */}
          <div className="card card-p">
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Invoice status breakdown</div>
            {Object.entries(data?.status_breakdown || {}).map(([status, count]: any) => (
              <div key={status} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span className={`badge ${getStatusClass(status)}`} style={{ minWidth:70, justifyContent:'center' }}>{status}</span>
                <div style={{ flex:1, height:5, background:'var(--bg)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:3, width: s.invoice_count > 0 ? `${(count/s.invoice_count)*100}%` : '0%',
                    background: status==='paid'?'var(--green)':status==='overdue'?'var(--red)':status==='sent'?'var(--blue)':'var(--border-strong)' }} />
                </div>
                <span style={{ fontSize:12, color:'var(--text-muted)', minWidth:20, textAlign:'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="card card-p" style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Revenue vs expenses — last 6 months</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chart} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1a1814" stopOpacity={0.12}/><stop offset="95%" stopColor="#1a1814" stopOpacity={0}/></linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dc2626" stopOpacity={0.08}/><stop offset="95%" stopColor="#dc2626" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-subtle)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => `${formatCurrency(v,currency).split('.')[0]}`}/>
              <Tooltip contentStyle={{ background:'#1a1814', border:'none', borderRadius:8, color:'white', fontSize:12 }} formatter={(v: any, name: string) => [fmt(v), name==='revenue'?'Revenue':'Expenses']}/>
              <Area type="monotone" dataKey="revenue" stroke="#1a1814" strokeWidth={2} fill="url(#rev)"/>
              <Area type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} fill="url(#exp)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Overdue */}
        {overdue.length > 0 && (
          <div className="card" style={{ borderColor:'#fecaca', padding:0, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #fecaca', display:'flex', alignItems:'center', gap:8 }}>
              <AlertTriangle size={14} color="var(--red)"/>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--red)' }}>Overdue invoices ({overdue.length})</span>
            </div>
            <div className="table-wrapper"><table className="data-table">
              <thead><tr><th>Invoice</th><th>Client</th><th>Due date</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {overdue.map((inv: any) => (
                  <tr key={inv.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td style={{ fontWeight:500 }}>{inv.invoice_number}</td>
                    <td style={{ color:'var(--text-muted)' }}>{inv.client_name || '—'}</td>
                    <td style={{ color:'var(--red)' }}>{formatDate(inv.due_date)}</td>
                    <td><span className="currency-amount">{formatCurrency(inv.total, inv.currency)}</span></td>
                    <td><button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); navigate(`/invoices/${inv.id}`) }}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* Empty state */}
        {!overdue.length && s.invoice_count === 0 && (
          <div className="card card-p" style={{ textAlign:'center', padding:40 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🚀</div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Welcome to InvoicePro!</div>
            <div style={{ color:'var(--text-muted)', fontSize:13, marginBottom:20 }}>Create your first invoice and start getting paid professionally.</div>
            <button className="btn btn-primary" onClick={() => navigate('/invoices')}><Plus size={15}/> Create your first invoice</button>
          </div>
        )}
      </div>
    </>
  )
}
