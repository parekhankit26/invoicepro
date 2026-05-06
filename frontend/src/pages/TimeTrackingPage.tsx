import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Clock, Trash2, FileText, X, Play, Square } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'

export default function TimeTrackingPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [filterClient, setFilterClient] = useState('')
  const [timer, setTimer] = useState<{ running: boolean; start: Date | null; seconds: number }>({ running: false, start: null, seconds: 0 })

  const { data, isLoading } = useQuery({
    queryKey: ['time-entries', filterClient],
    queryFn: () => api.get<any>(`/time?${filterClient ? `client_id=${filterClient}` : ''}`)
  })

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => api.get<any[]>('/clients') })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/time/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }); toast.success('Entry deleted') }
  })

  const convertMutation = useMutation({
    mutationFn: (data: any) => api.post('/time/convert-to-invoice', data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success(`Invoice ${data.invoice_number} created — ${data.total_hours}h, ${formatCurrency(data.total_amount)}`)
      setShowConvertModal(false); setSelectedEntries([])
    },
    onError: (e: any) => toast.error(e.message)
  })

  const entries = data?.data || []
  const summary = data?.summary || {}
  const clientList = Array.isArray(clients) ? clients : []

  const toggleEntry = (id: string) => {
    setSelectedEntries(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Time tracking</h1>
          <p className="page-subtitle">Log hours and convert to invoices</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedEntries.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowConvertModal(true)}>
              <FileText size={14} /> Convert {selectedEntries.length} entries to invoice
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> Log time</button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="metric-card">
            <div className="metric-label">Total hours</div>
            <div className="metric-value">{(summary.total_hours || 0).toFixed(1)}h</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total value</div>
            <div className="metric-value" style={{ color: 'var(--green)' }}>{formatCurrency(summary.total_amount || 0)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Unbilled</div>
            <div className="metric-value" style={{ color: 'var(--amber)' }}>{formatCurrency(summary.unbilled_amount || 0)}</div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <select className="form-select" style={{ width: 200 }} value={filterClient} onChange={e => setFilterClient(e.target.value)}>
            <option value="">All clients</option>
            {clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedEntries.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedEntries([])}>Clear selection ({selectedEntries.length})</button>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoading ? <div className="empty-state">Loading...</div> :
          entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Clock size={20} /></div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>No time entries yet</div>
              <div style={{ fontSize: 13 }}>Log your billable hours and convert them to invoices</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}><Plus size={15} /> Log time</button>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th style={{ width: 40 }}></th>
                <th>Date</th><th>Client</th><th>Project</th><th>Description</th>
                <th>Hours</th><th>Rate</th><th>Amount</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id} style={{ opacity: e.is_billed ? 0.6 : 1 }}>
                    <td>
                      <input type="checkbox" checked={selectedEntries.includes(e.id)} onChange={() => toggleEntry(e.id)}
                        disabled={e.is_billed || !e.is_billable} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{formatDate(e.date)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{e.clients?.name || '—'}</td>
                    <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{e.project || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                    <td style={{ fontWeight: 600 }}>{e.hours}h</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatCurrency(e.hourly_rate)}/h</td>
                    <td className="currency-amount">{formatCurrency(e.amount)}</td>
                    <td>
                      {e.is_billed ? <span className="badge badge-paid">Billed</span> :
                       e.is_billable ? <span className="badge badge-pending">Unbilled</span> :
                       <span className="badge badge-draft">Non-billable</span>}
                    </td>
                    <td>
                      {!e.is_billed && (
                        <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(e.id) }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Log Time Modal */}
      {showModal && (
        <LogTimeModal clients={clientList} onClose={() => setShowModal(false)}
          onSave={() => { qc.invalidateQueries({ queryKey: ['time-entries'] }); setShowModal(false) }} />
      )}

      {/* Convert Modal */}
      {showConvertModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConvertModal(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Convert to invoice</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowConvertModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                {selectedEntries.length} time entries will be added as line items to a new invoice.
              </p>
              <ConvertForm clients={clientList} entryIds={selectedEntries} onConvert={data => convertMutation.mutate(data)} isPending={convertMutation.isPending} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function LogTimeModal({ clients, onClose, onSave }: any) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { date: new Date().toISOString().split('T')[0], hours: 1, hourly_rate: 75, is_billable: true }
  })
  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/time', data),
    onSuccess: () => { toast.success('Time logged!'); onSave() },
    onError: (e: any) => toast.error(e.message)
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Log time</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description *</label>
                <input {...(register as any)('description', { required: true })} className="form-input" placeholder="What did you work on?" />
              </div>
              <div className="form-group">
                <label className="form-label">Client</label>
                <select {...(register as any)('client_id')} className="form-select">
                  <option value="">No client</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Project</label>
                <input {...(register as any)('project')} className="form-input" placeholder="Project name" />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input {...(register as any)('date')} className="form-input" type="date" />
              </div>
              <div className="form-group">
                <label className="form-label">Hours *</label>
                <input {...(register as any)('hours', { required: true, valueAsNumber: true })} className="form-input" type="number" min="0.1" step="0.25" />
              </div>
              <div className="form-group">
                <label className="form-label">Hourly rate (£) *</label>
                <input {...(register as any)('hourly_rate', { required: true, valueAsNumber: true })} className="form-input" type="number" min="0" step="0.01" />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input {...(register as any)('is_billable')} type="checkbox" id="billable" style={{ width: 'auto' }} defaultChecked />
                <label htmlFor="billable" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Billable to client</label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Log time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConvertForm({ clients, entryIds, onConvert, isPending }: any) {
  const { register, handleSubmit } = useForm({ defaultValues: { due_days: 30 } })
  return (
    <form onSubmit={handleSubmit(d => onConvert({ ...d, entry_ids: entryIds }))}>
      <div className="form-group">
        <label className="form-label">Client *</label>
        <select {...(register as any)('client_id', { required: true })} className="form-select">
          <option value="">Select client...</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Payment due (days)</label>
        <input {...(register as any)('due_days', { valueAsNumber: true })} className="form-input" type="number" min="1" />
      </div>
      <div className="modal-footer" style={{ padding: 0, marginTop: 16 }}>
        <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: '100%', justifyContent: 'center' }}>
          {isPending ? 'Creating invoice...' : 'Create invoice from selected entries'}
        </button>
      </div>
    </form>
  )
}
