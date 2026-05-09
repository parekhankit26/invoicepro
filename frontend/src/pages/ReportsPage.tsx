import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#1a1814','#4b5563','#6b7280','#9ca3af','#d1d5db','#374151','#111827']

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('all')
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<any>('/dashboard/overview') })
  const { data: expSummary } = useQuery({ queryKey: ['expense-summary'], queryFn: () => api.get<any>('/expenses/summary') })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })

  const currency = profile?.default_currency || 'GBP'
  const fmt = (v: number) => formatCurrency(v, currency)

  if (isLoading) return <div className="page-body" style={{ paddingTop:32, color:'var(--text-subtle)' }}>Loading reports...</div>

  const s = data?.summary || {}
  const monthly = data?.monthly_chart || []
  const statusData = Object.entries(data?.status_breakdown || {}).map(([name, value]) => ({ name, value: value as number })).filter(d => d.value > 0)
  const expData = Object.entries(expSummary?.by_category || {}).map(([name, value]) => ({ name, value: value as number })).sort((a,b) => b.value - a.value)
  const margin = s.total_paid > 0 ? ((s.net_profit / s.total_paid) * 100).toFixed(1) : '0'
  const profitPositive = (s.net_profit || 0) >= 0

  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Revenue', s.total_paid || 0],
      ['Total Expenses', s.total_expenses || 0],
      ['Net Profit', s.net_profit || 0],
      ['Profit Margin %', margin],
      ['Outstanding', s.total_pending || 0],
      ['Overdue', s.total_overdue || 0],
      ['Total Billed', s.total_billed || 0],
      ['Invoice Count', s.invoice_count || 0],
      ['Payment Rate %', s.payment_rate || 0],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `invoicepro-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Report exported!')
  }

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Financial overview & analytics</p></div>
        <button className="btn btn-secondary" onClick={exportCSV}><Download size={15}/> Export CSV</button>
      </div>

      <div className="page-body">
        {/* KPI strip */}
        <div className="card" style={{ marginBottom:16, padding:0, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)' }}>
            {[
              { label:'Total revenue',  value:fmt(s.total_paid||0),     color:'var(--green)',  icon:<TrendingUp size={14}/> },
              { label:'Total expenses', value:fmt(s.total_expenses||0),  color:'var(--red)',   icon:<TrendingDown size={14}/> },
              { label:'Net profit',     value:fmt(s.net_profit||0),      color:profitPositive?'var(--green)':'var(--red)', icon: null },
              { label:'Profit margin',  value:`${margin}%`,              color:parseFloat(margin)>=0?'var(--green)':'var(--red)', icon: null },
              { label:'Outstanding',    value:fmt(s.total_pending||0),   color:'var(--amber)', icon: null },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ padding:'16px 20px', borderRight:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', marginBottom:6 }}>{label}</div>
                  {icon && <div style={{ color }}>{icon}</div>}
                </div>
                <div style={{ fontSize:20, fontWeight:700, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          {/* Monthly bar chart */}
          <div className="card card-p">
            <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Monthly revenue vs expenses</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top:4, right:4, bottom:0, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-subtle)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => `${fmt(v).split('.')[0]}`}/>
                <Tooltip contentStyle={{ background:'#1a1814', border:'none', borderRadius:8, color:'white', fontSize:12 }} formatter={(v:any, name:string) => [fmt(v), name==='revenue'?'Revenue':'Expenses']}/>
                <Bar dataKey="revenue" fill="#1a1814" radius={[4,4,0,0]} name="revenue"/>
                <Bar dataKey="expenses" fill="#e5e0d8" radius={[4,4,0,0]} name="expenses"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Invoice status pie */}
          <div className="card card-p">
            <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Invoice status distribution</div>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {statusData.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }}/>
                  <Tooltip contentStyle={{ background:'#1a1814', border:'none', borderRadius:8, color:'white', fontSize:12 }} formatter={(v:any, name:string) => [`${v} invoices`, name]}/>
                </PieChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign:'center', color:'var(--text-subtle)', padding:40, fontSize:13 }}>No invoice data yet</div>}
          </div>
        </div>

        {/* Net profit trend */}
        <div className="card card-p" style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Net profit trend</div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={monthly.map((m: any) => ({ ...m, profit: m.revenue - m.expenses }))} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="profit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-subtle)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => `${fmt(v).split('.')[0]}`}/>
              <Tooltip contentStyle={{ background:'#1a1814', border:'none', borderRadius:8, color:'white', fontSize:12 }} formatter={(v:any) => [fmt(v), 'Net profit']}/>
              <Area type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} fill="url(#profit)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense breakdown */}
        {expData.length > 0 && (
          <div className="card card-p">
            <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Expense breakdown by category</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                {expData.map(({ name, value }, i) => (
                  <div key={name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:COLORS[i%COLORS.length], flexShrink:0 }}/>
                    <span style={{ flex:1, fontSize:13 }}>{name}</span>
                    <span style={{ fontSize:13, fontWeight:600 }} className="currency-amount">{fmt(value)}</span>
                    <span style={{ fontSize:11, color:'var(--text-subtle)', minWidth:36 }}>
                      {expSummary?.total ? `${((value/expSummary.total)*100).toFixed(0)}%` : ''}
                    </span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={expData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                    {expData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ background:'#1a1814', border:'none', borderRadius:8, color:'white', fontSize:12 }} formatter={(v:any) => [fmt(v)]}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
