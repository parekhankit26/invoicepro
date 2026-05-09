import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone, FileText, Plus, Link, Globe, Edit2, X, MapPin, CreditCard, Archive } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { formatCurrency, formatDate, getStatusClass, CURRENCIES } from '../lib/utils'
import toast from 'react-hot-toast'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [portalUrl, setPortalUrl] = useState('')

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get<any>(`/clients/${id}`)
  })

  const { register, handleSubmit, reset } = useForm<any>()

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/clients/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); toast.success('Client updated!'); setShowEdit(false) },
    onError: (e: any) => toast.error(e.message)
  })

  const portalMutation = useMutation({
    mutationFn: () => api.post(`/portal/generate/${id}`, {}),
    onSuccess: (data: any) => {
      setPortalUrl(data.portal_url)
      navigator.clipboard.writeText(data.portal_url).catch(() => {})
      toast.success('Portal link copied to clipboard!')
    },
    onError: (e: any) => toast.error(e.message)
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.put(`/clients/${id}`, { is_archived: true }),
    onSuccess: () => { toast.success('Client archived'); navigate('/clients') },
    onError: (e: any) => toast.error(e.message)
  })

  if (isLoading) return <div className="page-body" style={{ paddingTop:32, color:'var(--text-subtle)' }}>Loading...</div>
  if (!client) return <div className="page-body" style={{ paddingTop:32 }}>Client not found</div>

  const stats = client.stats || {}
  const invoices = client.invoices || []
  const currency = client.currency || 'GBP'

  const openEdit = () => { reset(client); setShowEdit(true) }

  return (
    <>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/clients')}><ArrowLeft size={18}/></button>
          <div>
            <h1 className="page-title">{client.name}</h1>
            {client.company && <p className="page-subtitle">{client.company}</p>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={openEdit}><Edit2 size={14}/> Edit</button>
          <button className="btn btn-secondary" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
            <Link size={14}/> {portalMutation.isPending ? 'Generating...' : 'Client portal link'}
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/invoices')}><Plus size={15}/> New invoice</button>
        </div>
      </div>

      <div className="page-body">
        <div className="client-detail-grid" style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16 }}>
          {/* Left panel */}
          <div>
            <div className="card card-p" style={{ marginBottom:12 }}>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:14 }}>Contact details</div>
              {client.email && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:13 }}>
                  <Mail size={14} color="var(--blue)"/>
                  <a href={`mailto:${client.email}`} style={{ color:'var(--blue)', textDecoration:'none' }}>{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:13 }}>
                  <Phone size={14} color="var(--text-subtle)"/>
                  <a href={`tel:${client.phone}`} style={{ color:'inherit', textDecoration:'none' }}>{client.phone}</a>
                </div>
              )}
              {client.website && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:13 }}>
                  <Globe size={14} color="var(--text-subtle)"/>
                  <a href={client.website} target="_blank" rel="noopener noreferrer" style={{ color:'var(--blue)', textDecoration:'none' }}>{client.website.replace('https://','')}</a>
                </div>
              )}
              {client.address && (
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10, fontSize:13 }}>
                  <MapPin size={14} color="var(--text-subtle)" style={{ marginTop:2, flexShrink:0 }}/>
                  <span style={{ color:'var(--text-muted)', lineHeight:1.5 }}>{client.address}</span>
                </div>
              )}
              {client.tax_number && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13 }}>
                  <CreditCard size={14} color="var(--text-subtle)"/>
                  <span style={{ color:'var(--text-subtle)' }}>Tax: {client.tax_number}</span>
                </div>
              )}
              {client.notes && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)', fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>
                  {client.notes}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="form-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              {[
                ['Total billed', formatCurrency(stats.total_billed||0, currency), 'var(--text)'],
                ['Collected', formatCurrency(stats.total_paid||0, currency), 'var(--green)'],
                ['Outstanding', formatCurrency(stats.outstanding||0, currency), stats.outstanding > 0 ? 'var(--amber)' : 'var(--text)'],
                ['Invoices', stats.invoice_count||0, 'var(--text)'],
              ].map(([l, v, color]) => (
                <div key={l as string} className="metric-card" style={{ padding:14 }}>
                  <div className="metric-label">{l}</div>
                  <div style={{ fontSize:17, fontWeight:700, color: color as string }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Portal link display */}
            {portalUrl && (
              <div className="card card-p" style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Portal link</div>
                <div style={{ fontSize:11, color:'var(--text-subtle)', wordBreak:'break-all', background:'var(--bg)', padding:8, borderRadius:6, marginBottom:8 }}>{portalUrl}</div>
                <button className="btn btn-sm btn-secondary" style={{ width:'100%', justifyContent:'center' }} onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Copied!') }}>
                  Copy link
                </button>
              </div>
            )}

            {/* Archive */}
            <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'center', color:'var(--text-subtle)' }}
              onClick={() => { if(confirm('Archive this client? They won\'t appear in your list.')) archiveMutation.mutate() }}>
              <Archive size={13}/> Archive client
            </button>
          </div>

          {/* Right panel — invoice history */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontWeight:600, fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
                <FileText size={14}/> Invoice history ({invoices.length})
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => navigate('/invoices')}><Plus size={12}/> New invoice</button>
            </div>
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              {invoices.length === 0 ? (
                <div className="empty-state" style={{ padding:32 }}>
                  <div style={{ fontSize:13, color:'var(--text-subtle)' }}>No invoices yet for this client</div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Invoice</th><th>Issue date</th><th>Due</th><th>Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <td style={{ fontWeight:600, fontFamily:'monospace', fontSize:13 }}>{inv.invoice_number}</td>
                        <td style={{ color:'var(--text-subtle)', fontSize:12 }}>{formatDate(inv.issue_date)}</td>
                        <td style={{ color: new Date(inv.due_date) < new Date() && inv.status !== 'paid' ? 'var(--red)' : 'var(--text-muted)', fontSize:12 }}>{formatDate(inv.due_date)}</td>
                        <td className="currency-amount" style={{ fontWeight:500 }}>{formatCurrency(inv.total, inv.currency)}</td>
                        <td><span className={`badge ${getStatusClass(inv.status)}`}>{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEdit(false)}>
          <div className="modal-box" style={{ maxWidth:580 }}>
            <div className="modal-header">
              <h2 style={{ fontSize:17, fontWeight:700 }}>Edit client</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowEdit(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit(d => updateMutation.mutate(d))}>
              <div className="modal-body">
                <div className="form-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}>
                    <label className="form-label">Full name / Business name *</label>
                    <input {...register('name', { required:true })} className="form-input"/>
                  </div>
                  <div className="form-group"><label className="form-label">Email</label><input {...register('email')} className="form-input" type="email"/></div>
                  <div className="form-group"><label className="form-label">Phone</label><input {...register('phone')} className="form-input"/></div>
                  <div className="form-group"><label className="form-label">Company</label><input {...register('company')} className="form-input"/></div>
                  <div className="form-group">
                    <label className="form-label">Default currency</label>
                    <select {...register('currency')} className="form-select">
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Tax / VAT number</label><input {...register('tax_number')} className="form-input"/></div>
                  <div className="form-group"><label className="form-label">Website</label><input {...register('website')} className="form-input"/></div>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}><label className="form-label">Address</label><textarea {...register('address')} className="form-input" rows={2} style={{ resize:'vertical' }}/></div>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}><label className="form-label">Notes</label><textarea {...register('notes')} className="form-input" rows={2} style={{ resize:'vertical' }}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Update client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
