import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Send, CheckCircle, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate, getStatusClass, isOverdue } from '../lib/utils'
import InvoiceModal from '../components/InvoiceModal'
import toast from 'react-hot-toast'

export default function InvoicesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['invoices', statusFilter, search], queryFn: () => api.get<any>(`/invoices?${new URLSearchParams({ ...(statusFilter && { status: statusFilter }), ...(search && { search }), limit: '50' })}`) })

  const sendMutation = useMutation({ mutationFn: (id: string) => api.post(`/invoices/${id}/send`, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice sent!') }, onError: (e: any) => toast.error(e.message) })
  const markPaidMutation = useMutation({ mutationFn: (id: string) => api.post(`/invoices/${id}/mark-paid`, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Marked as paid!') }, onError: (e: any) => toast.error(e.message) })
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/invoices/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Deleted') }, onError: (e: any) => toast.error(e.message) })

  const invoices = data?.data || []
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Invoices</h1><p className="page-subtitle">{data?.total || 0} total invoices</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> New invoice</button>
      </div>
      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input className="form-input" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            {['','draft','sent','pending','paid','overdue','cancelled'].map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoading ? <div className="empty-state">Loading...</div> : invoices.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon"><Plus size={20} /></div><div style={{ fontWeight: 500 }}>No invoices yet</div><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}><Plus size={15} /> Create invoice</button></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Client</th><th>Issue date</th><th>Due date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const over = isOverdue(inv.due_date, inv.status)
                  return (
                    <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{inv.invoice_number}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{inv.clients?.name || '—'}</td>
                      <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{formatDate(inv.issue_date)}</td>
                      <td style={{ color: over ? 'var(--red)' : 'var(--text-muted)', fontSize: 12 }}>{formatDate(inv.due_date)}</td>
                      <td><span className="currency-amount">{formatCurrency(inv.total, inv.currency)}</span></td>
                      <td><span className={`badge ${getStatusClass(over ? 'overdue' : inv.status)}`}>{over ? 'overdue' : inv.status}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {inv.status !== 'paid' && <button className="btn btn-sm btn-secondary" onClick={() => sendMutation.mutate(inv.id)}><Send size={12} /></button>}
                          {inv.status !== 'paid' && <button className="btn btn-sm btn-secondary" onClick={() => markPaidMutation.mutate(inv.id)}><CheckCircle size={12} /></button>}
                          <button className="btn btn-sm btn-secondary" onClick={() => api.downloadPDF(inv.id, inv.invoice_number).catch(e => toast.error(e.message))}><Download size={12} /></button>
                          {inv.status === 'draft' && <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(inv.id) }}><Trash2 size={12} /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showModal && <InvoiceModal onClose={() => setShowModal(false)} onSave={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowModal(false) }} />}
    </>
  )
}
