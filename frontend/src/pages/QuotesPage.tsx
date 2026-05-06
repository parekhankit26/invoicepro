import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, FileText, CheckCircle, XCircle, RefreshCw, Trash2, Search } from 'lucide-react'
import { useForm, useFieldArray } from 'react-hook-form'
import { api } from '../lib/api'
import { formatCurrency, formatDate, CURRENCIES } from '../lib/utils'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-draft', sent: 'badge-sent', accepted: 'badge-paid',
  declined: 'badge-overdue', expired: 'badge-overdue', converted: 'badge-sent'
}

export default function QuotesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editQuote, setEditQuote] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', statusFilter, search],
    queryFn: () => api.get<any>(`/quotes?${new URLSearchParams({ ...(statusFilter && { status: statusFilter }), limit: '50' })}`)
  })

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => api.get<any[]>('/clients') })

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/send`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Quote sent to client!') },
    onError: (e: any) => toast.error(e.message)
  })

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/convert`, {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      toast.success(`Converted to invoice ${data.invoice_number}!`)
      navigate(`/invoices/${data.invoice_id}`)
    },
    onError: (e: any) => toast.error(e.message)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Quote deleted') },
    onError: (e: any) => toast.error(e.message)
  })

  const quotes = data?.data || []

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">{data?.total || 0} total quotes</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditQuote(null); setShowModal(true) }}>
          <Plus size={15} /> New quote
        </button>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input className="form-input" placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">All statuses</option>
            {['draft','sent','accepted','declined','expired','converted'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoading ? <div className="empty-state">Loading quotes...</div> :
          quotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><FileText size={20} /></div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>No quotes yet</div>
              <div style={{ fontSize: 13 }}>Create a quote and convert it to an invoice when accepted</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}><Plus size={15} /> New quote</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Quote #</th><th>Client</th><th>Amount</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {quotes.map((q: any) => (
                    <tr key={q.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{q.quote_number}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{q.clients?.name || '—'}</td>
                      <td><span className="currency-amount">{formatCurrency(q.total, q.currency)}</span></td>
                      <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{formatDate(q.expiry_date)}</td>
                      <td><span className={`badge ${STATUS_COLORS[q.status] || 'badge-draft'}`}>{q.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {q.status === 'draft' && (
                            <button className="btn btn-sm btn-secondary" title="Send" onClick={() => sendMutation.mutate(q.id)}><Send size={12} /></button>
                          )}
                          {q.status === 'accepted' && (
                            <button className="btn btn-sm btn-secondary" title="Convert to invoice" onClick={() => convertMutation.mutate(q.id)} style={{ color: 'var(--green)' }}>
                              <RefreshCw size={12} /> Convert
                            </button>
                          )}
                          {['draft','sent'].includes(q.status) && (
                            <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(q.id) }}><Trash2 size={12} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <QuoteModal
          quote={editQuote}
          clients={Array.isArray(clients) ? clients : []}
          onClose={() => { setShowModal(false); setEditQuote(null) }}
          onSave={() => { qc.invalidateQueries({ queryKey: ['quotes'] }); setShowModal(false) }}
        />
      )}
    </>
  )
}

function QuoteModal({ quote, clients, onClose, onSave }: any) {
  const isEdit = !!quote
  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]

  const { register, control, handleSubmit, watch } = useForm({
    defaultValues: quote ? {
      ...quote,
      items: quote.quote_items || [{ description: '', quantity: 1, unit_price: 0 }]
    } : {
      issue_date: today, expiry_date: in30, currency: 'GBP',
      tax_rate: 20, discount_percent: 0, notes: '', terms: 'Quote valid for 30 days.',
      items: [{ description: '', quantity: 1, unit_price: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')
  const taxRate = watch('tax_rate')
  const currency = watch('currency')

  const subtotal = (items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
  const taxAmt = subtotal * ((Number(taxRate) || 0) / 100)
  const total = subtotal + taxAmt

  const saveMutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.put(`/quotes/${quote.id}`, data) : api.post('/quotes', data),
    onSuccess: () => { toast.success(isEdit ? 'Quote updated!' : 'Quote created!'); onSave() },
    onError: (e: any) => toast.error(e.message)
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Edit quote' : 'New quote'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select {...register('client_id', { required: true })} className="form-select">
                  <option value="">Select client...</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select {...register('currency')} className="form-select">
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Issue date</label>
                <input {...register('issue_date')} className="form-input" type="date" />
              </div>
              <div className="form-group">
                <label className="form-label">Expiry date</label>
                <input {...register('expiry_date')} className="form-input" type="date" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Line items</label>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}><Plus size={12} /> Add</button>
              </div>
              {fields.map((field, i) => (
                <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 120px 36px', gap: 8, marginBottom: 6 }}>
                  <input {...register(`items.${i}.description`)} className="form-input" placeholder="Description..." />
                  <input {...register(`items.${i}.quantity`, { valueAsNumber: true })} className="form-input" type="number" min="0" step="0.01" />
                  <input {...register(`items.${i}.unit_price`, { valueAsNumber: true })} className="form-input" type="number" min="0" step="0.01" placeholder="0.00" />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(i)} disabled={fields.length === 1}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }}>
              <div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea {...register('notes')} className="form-input" rows={2} style={{ resize: 'vertical' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Terms</label>
                  <input {...register('terms')} className="form-input" />
                </div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16 }}>
                <div className="form-group">
                  <label className="form-label">Tax %</label>
                  <input {...register('tax_rate', { valueAsNumber: true })} className="form-input" type="number" min="0" />
                </div>
                {[['Subtotal', formatCurrency(subtotal, currency)], taxAmt > 0 ? [`Tax (${taxRate}%)`, formatCurrency(taxAmt, currency)] : null].filter(Boolean).map(([l, v]: any) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}><span>{l}</span><span>{v}</span></div>
                ))}
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                  <span>Total</span><span>{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update quote' : 'Create quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
