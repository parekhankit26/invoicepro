import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
const COLORS = ['#1a1814','#756d5c','#b8b2a3','#d9d5cb','#eeece6']
export default function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<any>('/dashboard/overview') })
  const { data: expSummary } = useQuery({ queryKey: ['expense-summary'], queryFn: () => api.get<any>('/expenses/summary') })
  if (isLoading) return <div className="page-body" style={{ paddingTop: 32, color: 'var(--text-subtle)' }}>Loading...</div>
  const s = data?.summary || {}
  const monthly = data?.monthly_chart || []
  const statusData = Object.entries(data?.status_breakdown || {}).map(([name, value]) => ({ name, value: value as number })).filter(d => d.value > 0)
  const expData = Object.entries(expSummary?.by_category || {}).map(([name, value]) => ({ name, value: value as number }))
  const margin = s.total_paid > 0 ? ((s.net_profit / s.total_paid) * 100).toFixed(1) : '0'
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Reports</h1><p className="page-subtitle">Financial overview</p></div></div>
      <div className="page-body">
        <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderBottom: '1px solid var(--border)' }}>
            {[['Total revenue', formatCurrency(s.total_paid||0),'var(--green)'],['Total expenses', formatCurrency(s.total_expenses||0),'var(--red)'],['Net profit', formatCurrency(s.net_profit||0),(s.net_profit||0)>=0?'var(--green)':'var(--red)'],['Profit margin', `${margin}%`,parseFloat(margin)>=0?'var(--green)':'var(--red)'],['Outstanding', formatCurrency(s.total_pending||0),'var(--amber)']].map(([label, value, color]: any) => (
              <div key={label} style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card card-p"><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Monthly revenue vs expenses</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v>=1000?`${(v/1000).toFixed(0)}k`:v}`} />
                <Tooltip contentStyle={{ background: '#1a1814', border: 'none', borderRadius: 8, color: 'white', fontSize: 12 }} formatter={(v: any, name: string) => [formatCurrency(v), name === 'revenue' ? 'Revenue' : 'Expenses']} />
                <Bar dataKey="revenue" fill="#1a1814" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" fill="#e5e0d8" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card card-p"><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Invoice status</div>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>{statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} /><Tooltip contentStyle={{ background: '#1a1814', border: 'none', borderRadius: 8, color: 'white', fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', color: 'var(--text-subtle)', padding: 40, fontSize: 13 }}>No data yet</div>}
          </div>
        </div>
        {expData.length > 0 && (
          <div className="card card-p"><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Expense breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>{expData.sort((a,b) => b.value-a.value).map(({name,value},i) => (<div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i%COLORS.length], flexShrink: 0 }} /><span style={{ flex: 1, fontSize: 13 }}>{name}</span><span className="currency-amount" style={{ fontWeight: 600 }}>{formatCurrency(value)}</span></div>))}</div>
              <ResponsiveContainer width="100%" height={180}><PieChart><Pie data={expData} cx="50%" cy="50%" outerRadius={75} dataKey="value">{expData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: '#1a1814', border: 'none', borderRadius: 8, color: 'white', fontSize: 12 }} formatter={(v: any) => [formatCurrency(v)]} /></PieChart></ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
