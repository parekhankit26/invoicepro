import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ChevronRight, X, Users, TrendingUp, Archive } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { CURRENCIES } from '../lib/utils'
import toast from 'react-hot-toast'
import { modalState } from '../lib/modalState'

export default function ClientsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editClient, setEditClient] = useState<any>(null)

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })
  const defaultCurrency = profile?.default_currency || 'GBP'

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => api.get<any[]>(`/clients${search ? `?search=${search}` : ''}`)
  })
  const { register, handleSubmit, reset } = useForm<any>()

  const saveMutation = useMutation({
    mutationFn: (data: any) => editClient
      ? api.put(`/clients/${editClient.id}`, data)
      : api.post('/clients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success(editClient ? 'Client updated!' : 'Client added!')
      { setShowModal(false); modalState.close() }; setEditClient(null)
    },
    onError: (e: any) => toast.error(e.message)
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/clients/${id}`, { is_archived: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client archived') },
    onError: (e: any) => toast.error(e.message)
  })

  const openAdd = () => { reset({ currency: defaultCurrency }); setEditClient(null); { setShowModal(true); modalState.open() } }
  const openEdit = (c: any) => { reset(c); setEditClient(c); { setShowModal(true); modalState.open() } }

  const clientList = Array.isArray(clients) ? clients : []
  const totalClients = clientList.length

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{totalClients} client{totalClients !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/> Add client</button>
      </div>

      <div className="page-body">
        {/* Search */}
        <div style={{ position:'relative', marginBottom:16, maxWidth:360 }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-subtle)' }}/>
          <input className="form-input" placeholder="Search clients by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:32 }}/>
        </div>

        {/* Table */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {isLoading ? (
            <div className="empty-state">Loading...</div>
          ) : clientList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Users size={20}/></div>
              <div style={{ fontWeight:500, marginBottom:4 }}>No clients yet</div>
              <div style={{ fontSize:13, color:'var(--text-subtle)', marginBottom:16 }}>Add your first client to start creating invoices</div>
              <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/> Add client</button>
            </div>
          ) : (
            <div className="table-wrapper"><table className="data-table">
              <thead>
                <tr><th>Client</th><th>Email</th><th>Phone</th><th>Currency</th><th>Tax number</th><th></th></tr>
              </thead>
              <tbody>
                {clientList.map((c: any) => (
                  <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/clients/${c.id}`)}>
                    <td>
                      <div style={{ fontWeight:600 }}>{c.name}</div>
                      {c.company && <div style={{ fontSize:12, color:'var(--text-subtle)' }}>{c.company}</div>}
                    </td>
                    <td style={{ color:'var(--text-muted)' }}>{c.email || '—'}</td>
                    <td style={{ color:'var(--text-subtle)' }}>{c.phone || '—'}</td>
                    <td><span className="badge badge-draft">{c.currency || 'GBP'}</span></td>
                    <td style={{ color:'var(--text-subtle)', fontSize:12 }}>{c.tax_number || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c)}>Edit</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/clients/${c.id}`)}>View <ChevronRight size={12}/></button>
                        <button className="btn btn-sm btn-secondary" title="Archive" onClick={() => { if(confirm('Archive this client?')) archiveMutation.mutate(c.id) }}>
                          <Archive size={12}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowModal(false), modalState.close())}>
          <div className="modal-box" style={{ maxWidth:580 }}>
            <div className="modal-header">
              <h2 style={{ fontSize:17, fontWeight:700 }}>{editClient ? 'Edit client' : 'Add client'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { { setShowModal(false); modalState.close() }; setEditClient(null) }}><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
              <div className="modal-body">
                <div className="form-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}>
                    <label className="form-label">Full name / Business name *</label>
                    <input {...register('name', { required:true })} className="form-input" placeholder="Acme Ltd or John Smith"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input {...register('email')} className="form-input" type="email" placeholder="client@example.com"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input {...register('phone')} className="form-input" placeholder="+44 7700 000000"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company name</label>
                    <input {...register('company')} className="form-input" placeholder="Company (if different)"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default currency</label>
                    <select {...register('currency')} className="form-select">
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tax / VAT number</label>
                    <input {...register('tax_number')} className="form-input" placeholder="e.g. GB 123456789"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Website</label>
                    <input {...register('website')} className="form-input" placeholder="https://..."/>
                  </div>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}>
                    <label className="form-label">Billing address</label>
                    <textarea {...register('address')} className="form-input" rows={2} style={{ resize:'vertical' }} placeholder="Street, City, Postcode, Country"/>
                  </div>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}>
                    <label className="form-label">Notes</label>
                    <textarea {...register('notes')} className="form-input" rows={2} style={{ resize:'vertical' }} placeholder="Payment terms, preferences, contacts..."/>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { { setShowModal(false); modalState.close() }; setEditClient(null) }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : editClient ? 'Update client' : 'Add client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
