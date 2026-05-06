import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ChevronRight, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

export default function ClientsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editClient, setEditClient] = useState<any>(null)
  const { data: clients = [], isLoading } = useQuery({ queryKey: ['clients', search], queryFn: () => api.get<any[]>(`/clients${search ? `?search=${search}` : ''}`) })
  const { register, handleSubmit, reset } = useForm<any>()
  const saveMutation = useMutation({
    mutationFn: (data: any) => editClient ? api.put(`/clients/${editClient.id}`, data) : api.post('/clients', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success(editClient ? 'Updated!' : 'Client added!'); setShowModal(false); setEditClient(null) },
    onError: (e: any) => toast.error(e.message)
  })
  const clientList = Array.isArray(clients) ? clients : []
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Clients</h1><p className="page-subtitle">{clientList.length} clients</p></div>
        <button className="btn btn-primary" onClick={() => { reset({}); setEditClient(null); setShowModal(true) }}><Plus size={15} /> Add client</button>
      </div>
      <div className="page-body">
        <div style={{ position: 'relative', marginBottom: 16, maxWidth: 340 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
          <input className="form-input" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoading ? <div className="empty-state">Loading...</div> : clientList.length === 0 ? (
            <div className="empty-state"><div style={{ fontWeight: 500 }}>No clients yet</div><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}><Plus size={15} /> Add client</button></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Client</th><th>Email</th><th>Phone</th><th>Currency</th><th></th></tr></thead>
              <tbody>
                {clientList.map((c: any) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clients/${c.id}`)}>
                    <td><div style={{ fontWeight: 600 }}>{c.name}</div>{c.company && <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{c.company}</div>}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.email}</td>
                    <td style={{ color: 'var(--text-subtle)' }}>{c.phone || '—'}</td>
                    <td><span className="badge badge-draft">{c.currency || 'GBP'}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => { reset(c); setEditClient(c); setShowModal(true) }}>Edit</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/clients/${c.id}`)}>View <ChevronRight size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div className="modal-header"><h2 style={{ fontSize: 17, fontWeight: 700 }}>{editClient ? 'Edit client' : 'Add client'}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button></div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Name *</label><input {...register('name', { required: true })} className="form-input" placeholder="Acme Ltd" /></div>
                  <div className="form-group"><label className="form-label">Email *</label><input {...register('email', { required: true })} className="form-input" type="email" /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input {...register('phone')} className="form-input" /></div>
                  <div className="form-group"><label className="form-label">Company</label><input {...register('company')} className="form-input" /></div>
                  <div className="form-group"><label className="form-label">Currency</label><select {...register('currency')} className="form-select">{['GBP','USD','EUR','CAD','AUD','CHF','INR','AED'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Address</label><input {...register('address')} className="form-input" /></div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Notes</label><textarea {...register('notes')} className="form-input" rows={2} style={{ resize: 'vertical' }} /></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : editClient ? 'Update' : 'Add client'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
