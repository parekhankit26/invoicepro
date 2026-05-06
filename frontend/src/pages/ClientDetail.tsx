import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone, FileText, Plus, Link } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate, getStatusClass } from '../lib/utils'
import toast from 'react-hot-toast'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: client, isLoading } = useQuery({ queryKey: ['client', id], queryFn: () => api.get<any>(`/clients/${id}`) })
  const portalMutation = useMutation({
    mutationFn: () => api.post(`/portal/generate/${id}`, {}),
    onSuccess: (data: any) => { navigator.clipboard.writeText(data.portal_url); toast.success('Portal link copied to clipboard!') },
    onError: (e: any) => toast.error(e.message)
  })
  if (isLoading) return <div className="page-body" style={{ paddingTop: 32, color: 'var(--text-subtle)' }}>Loading...</div>
  if (!client) return <div className="page-body" style={{ paddingTop: 32 }}>Client not found</div>
  const stats = client.stats || {}
  const invoices = client.invoices || []
  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/clients')}><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">{client.name}</h1>{client.company && <p className="page-subtitle">{client.company}</p>}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}><Link size={14} /> {portalMutation.isPending ? 'Generating...' : 'Copy portal link'}</button>
          <button className="btn btn-primary" onClick={() => navigate(`/invoices`)}><Plus size={15} /> New invoice</button>
        </div>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          <div>
            <div className="card card-p" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Contact</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13 }}><Mail size={14} color="var(--blue)" /><span style={{ color: 'var(--blue)' }}>{client.email}</span></div>
              {client.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}><Phone size={14} color="var(--text-subtle)" /><span>{client.phone}</span></div>}
              {client.address && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>{client.address}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Total billed', formatCurrency(stats.total_billed||0)],['Collected', formatCurrency(stats.total_paid||0)],['Outstanding', formatCurrency(stats.outstanding||0)],['Invoices', stats.invoice_count||0]].map(([l, v]) => (
                <div key={l as string} className="metric-card" style={{ padding: 14 }}><div className="metric-label">{l}</div><div style={{ fontSize: 17, fontWeight: 700 }}>{v}</div></div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Invoice history</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {invoices.length === 0 ? <div className="empty-state"><div style={{ fontSize: 13 }}>No invoices yet</div></div> : (
                <table className="data-table">
                  <thead><tr><th>Invoice</th><th>Issue date</th><th>Due date</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>{invoices.map((inv: any) => (<tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/invoices/${inv.id}`)}><td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{inv.invoice_number}</td><td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{formatDate(inv.issue_date)}</td><td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(inv.due_date)}</td><td className="currency-amount">{formatCurrency(inv.total, inv.currency)}</td><td><span className={`badge ${getStatusClass(inv.status)}`}>{inv.status}</span></td></tr>))}</tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
