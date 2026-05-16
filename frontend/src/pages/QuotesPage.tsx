import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, FileText, CheckCircle, RefreshCw, Trash2, Search, X, Info, MessageSquare } from 'lucide-react'
import { useForm, useFieldArray } from 'react-hook-form'
import { api } from '../lib/api'
import { formatCurrency, formatDate, CURRENCIES } from '../lib/utils'
import { COUNTRY_LIST, COUNTRY_TAX_CONFIGS, CURRENCY_TO_COUNTRY, calculateTax } from '../lib/taxSystem'
import toast from 'react-hot-toast'
import { modalState } from '../lib/modalState'

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-draft', sent: 'badge-sent', accepted: 'badge-paid',
  declined: 'badge-overdue', expired: 'badge-overdue', converted: 'badge-sent',
}

export default function QuotesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editQuote, setEditQuote] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', statusFilter],
    queryFn: () => api.get<any>(`/quotes?${new URLSearchParams({ ...(statusFilter && { status: statusFilter }), limit: '50' })}`)
  })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => api.get<any[]>('/clients') })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/send`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Quote sent to client!') },
    onError: (e: any) => toast.error(e.message),
  })
  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/convert`, {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      toast.success(`Converted to invoice ${data.invoice_number}!`)
      navigate(`/invoices/${data.invoice_id}`)
    },
    onError: (e: any) => toast.error(e.message),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Quote deleted') },
    onError: (e: any) => toast.error(e.message),
  })
  const whatsappMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notify/whatsapp-quote/${id}`, {}),
    onSuccess: (data: any) => {
      window.open(data.wa_url, '_blank')
      toast.success(`WhatsApp opened for ${data.client_name} — tap Send to deliver`)
    },
    onError: (e: any) => toast.error(e.message.includes('phone') ? 'Add a phone number to this client first' : e.message),
  })

  const quotes = (data?.data || []).filter((q: any) =>
    !search || q.quote_number?.toLowerCase().includes(search.toLowerCase()) || q.clients?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Quotes</h1><p className="page-subtitle">{data?.total || 0} total</p></div>
        <button className="btn btn-primary" onClick={() => { setEditQuote(null); { setShowModal(true); modalState.open() } }}><Plus size={15}/> New quote</button>
      </div>
      <div className="page-body">
        <div className="filter-row" style={{ display:'flex', gap:10, marginBottom:16 }}>
          <div style={{ position:'relative', flex:1, maxWidth:300 }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-subtle)' }}/>
            <input className="form-input" placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:32 }}/>
          </div>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width:160 }}>
            <option value="">All statuses</option>
            {['draft','sent','accepted','declined','expired','converted'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {isLoading ? <div className="empty-state">Loading...</div> :
          quotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><FileText size={20}/></div>
              <div style={{ fontWeight:500, marginBottom:4 }}>No quotes yet</div>
              <div style={{ fontSize:13 }}>Send quotes to clients and convert accepted ones into invoices</div>
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => { setShowModal(true); modalState.open() }}><Plus size={15}/> New quote</button>
            </div>
          ) : (
            <div className="table-wrapper"><table className="data-table">
              <thead><tr><th>Quote #</th><th>Client</th><th>Amount</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {quotes.map((q: any) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight:600, fontFamily:'monospace', fontSize:13 }}>{q.quote_number}</td>
                    <td style={{ color:'var(--text-muted)' }}>{q.clients?.name || '—'}</td>
                    <td><span className="currency-amount">{formatCurrency(q.total, q.currency)}</span></td>
                    <td style={{ color: new Date(q.expiry_date) < new Date() && q.status === 'sent' ? 'var(--red)' : 'var(--text-subtle)', fontSize:12 }}>{formatDate(q.expiry_date)}</td>
                    <td><span className={`badge ${STATUS_COLORS[q.status] || 'badge-draft'}`}>{q.status}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setEditQuote(q); { setShowModal(true); modalState.open() } }}>Edit</button>
                        {q.status === 'draft' && <button className="btn btn-sm btn-secondary" title="Send to client" onClick={() => sendMutation.mutate(q.id)}><Send size={12}/></button>}
                        {['draft','sent'].includes(q.status) && (
                          <button className="btn btn-sm btn-secondary" title="Send via WhatsApp" style={{ color:'#25D366' }} onClick={() => whatsappMutation.mutate(q.id)}>
                            <MessageSquare size={12}/>
                          </button>
                        )}
                        {q.status === 'accepted' && (
                          <button className="btn btn-sm btn-secondary" style={{ color:'var(--green)' }} onClick={() => convertMutation.mutate(q.id)}>
                            <RefreshCw size={12}/> Convert
                          </button>
                        )}
                        {['draft','sent'].includes(q.status) && (
                          <button className="btn btn-sm btn-danger" onClick={() => { if(confirm('Delete this quote?')) deleteMutation.mutate(q.id) }}><Trash2 size={12}/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {showModal && (
        <QuoteModal
          quote={editQuote}
          clients={Array.isArray(clients) ? clients : []}
          profile={profile}
          onClose={() => { { setShowModal(false); modalState.close() }; setEditQuote(null) }}
          onSave={() => { qc.invalidateQueries({ queryKey: ['quotes'] }); { setShowModal(false); modalState.close() }; setEditQuote(null) }}
        />
      )}
    </>
  )
}

function QuoteModal({ quote, clients, profile, onClose, onSave }: any) {
  const isEdit = !!quote
  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]

  const defaultCurrency = profile?.default_currency || 'GBP'
  const defaultCountry = profile?.country_code || CURRENCY_TO_COUNTRY[defaultCurrency] || 'GB'
  const defaultTaxRate = profile?.default_tax_rate ?? COUNTRY_TAX_CONFIGS[defaultCountry]?.defaultRate ?? 20

  const { register, control, handleSubmit, watch, setValue } = useForm({
    defaultValues: quote ? {
      ...quote,
      items: quote.quote_items || [{ description: '', quantity: 1, unit_price: 0 }],
      country_code: quote.country_code || defaultCountry,
      tax_type: quote.tax_type || 'CGST_SGST',
    } : {
      issue_date: today, expiry_date: in30,
      currency: defaultCurrency, country_code: defaultCountry,
      tax_rate: defaultTaxRate, discount_percent: 0,
      tax_type: 'CGST_SGST',
      notes: '', terms: 'This quote is valid for 30 days from the issue date.',
      items: [{ description: '', quantity: 1, unit_price: 0 }],
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')
  const taxRate = watch('tax_rate')
  const currency = watch('currency')
  const discountPct = watch('discount_percent')
  const countryCode = watch('country_code')
  const taxType = watch('tax_type')

  const countryConfig = COUNTRY_TAX_CONFIGS[countryCode] || COUNTRY_TAX_CONFIGS['OTHER']

  const subtotal = (items || []).reduce((s: number, i: any) => s + (Number(i.quantity)||0) * (Number(i.unit_price)||0), 0)
  const taxResult = calculateTax(subtotal, Number(discountPct)||0, Number(taxRate)||0, countryCode, taxType)

  const saveMutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.put(`/quotes/${quote.id}`, data) : api.post('/quotes', data),
    onSuccess: () => { toast.success(isEdit ? 'Quote updated!' : 'Quote created!'); onSave() },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:760 }}>
        <div className="modal-header">
          <h2 style={{ fontSize:17, fontWeight:700 }}>{isEdit ? 'Edit quote' : 'New quote'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
          <div className="modal-body">
            {/* Row 1 */}
            <div className="form-grid-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select {...register('client_id', { required:true })} className="form-select">
                  <option value="">Select client...</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Issue date</label>
                <input {...register('issue_date')} className="form-input" type="date"/>
              </div>
              <div className="form-group">
                <label className="form-label">Expiry date</label>
                <input {...register('expiry_date')} className="form-input" type="date"/>
              </div>
            </div>

            {/* Row 2: Country + Currency + Discount */}
            <div className="form-grid-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:8 }}>
              <div className="form-group">
                <label className="form-label">Country / Tax system</label>
                <select {...register('country_code')} className="form-select" onChange={e => {
                  const cfg = COUNTRY_TAX_CONFIGS[e.target.value]
                  if (cfg) { setValue('country_code', e.target.value); setValue('currency', cfg.currency); setValue('tax_rate', cfg.defaultRate) }
                }}>
                  {COUNTRY_LIST.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select {...register('currency')} className="form-select">
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Discount %</label>
                <input {...register('discount_percent', { valueAsNumber:true })} className="form-input" type="number" min="0" max="100" step="0.01"/>
              </div>
            </div>

            {/* Tax section */}
            <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>{countryConfig.taxLabel} — {countryConfig.taxSystem}</span>
                <span style={{ fontSize:11, color:'var(--text-subtle)', background:'var(--bg-hover)', padding:'2px 6px', borderRadius:4 }}>{countryConfig.country}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns: countryCode === 'IN' ? '1fr 1fr 1fr' : '1fr 1fr', gap:12 }}>
                <div className="form-group" style={{ margin:0 }}>
                  <label className="form-label">{countryConfig.taxLabel} preset</label>
                  <select className="form-select" value={taxRate} onChange={e => setValue('tax_rate', Number(e.target.value))}>
                    {countryConfig.rates.map(r => <option key={r.label} value={r.rate}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin:0 }}>
                  <label className="form-label">Rate % (editable)</label>
                  <input {...register('tax_rate', { valueAsNumber:true })} className="form-input" type="number" min="0" max="100" step="0.01"/>
                </div>
                {countryCode === 'IN' && (
                  <div className="form-group" style={{ margin:0 }}>
                    <label className="form-label">Transaction type</label>
                    <select {...register('tax_type')} className="form-select">
                      <option value="CGST_SGST">Intra-state (CGST + SGST)</option>
                      <option value="IGST">Inter-state (IGST)</option>
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginTop:8 }}>
                <Info size={12} style={{ color:'var(--text-subtle)', marginTop:2, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:'var(--text-subtle)' }}>{countryConfig.uiHint}</span>
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <label className="form-label" style={{ margin:0 }}>Line items</label>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => append({ description:'', quantity:1, unit_price:0 })}><Plus size={12}/> Add line</button>
              </div>
              {fields.map((field, i) => {
                const amt = (Number(items?.[i]?.quantity)||0) * (Number(items?.[i]?.unit_price)||0)
                return (
                  <div key={field.id} className="line-item-row" style={{ display:'grid', gridTemplateColumns:'1fr 70px 110px 70px 36px', gap:6, marginBottom:6, alignItems:'center' }}>
                    <input {...register(`items.${i}.description`)} className="form-input" placeholder="Description..."/>
                    <input {...register(`items.${i}.quantity`, { valueAsNumber:true })} className="form-input" type="number" min="0" step="0.01" placeholder="Qty"/>
                    <input {...register(`items.${i}.unit_price`, { valueAsNumber:true })} className="form-input" type="number" min="0" step="0.01" placeholder="Unit price"/>
                    <span style={{ fontSize:13, textAlign:'right', color:'var(--text-muted)' }} className="currency-amount">{formatCurrency(amt, currency)}</span>
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(i)} disabled={fields.length === 1}><Trash2 size={14}/></button>
                  </div>
                )
              })}
            </div>

            {/* Notes + Tax summary */}
            <div className="tax-summary-grid" style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:16 }}>
              <div>
                <div className="form-group"><label className="form-label">Notes</label><textarea {...register('notes')} className="form-input" rows={2} style={{ resize:'vertical' }}/></div>
                <div className="form-group"><label className="form-label">Terms</label><input {...register('terms')} className="form-input"/></div>
              </div>
              <div style={{ background:'var(--bg)', borderRadius:10, padding:16, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-subtle)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>
                  {countryConfig.taxSystem} Breakdown
                </div>
                <TaxLine label="Subtotal" value={formatCurrency(taxResult.subtotal, currency)}/>
                {taxResult.discountAmount > 0 && <TaxLine label={`Discount (${discountPct}%)`} value={`-${formatCurrency(taxResult.discountAmount, currency)}`} color="#e74c3c"/>}
                {taxResult.discountAmount > 0 && <TaxLine label="Taxable amount" value={formatCurrency(taxResult.taxableAmount, currency)} subtle/>}
                {taxResult.taxLines.map(line => <TaxLine key={line.label} label={line.label} value={formatCurrency(line.amount, currency)} color="var(--blue)"/>)}
                {taxRate === 0 && <TaxLine label={`${countryConfig.taxLabel} (0%)`} value="Exempt" subtle/>}
                <div style={{ borderTop:'2px solid var(--text)', paddingTop:10, marginTop:6, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:15 }}>
                  <span>Total</span>
                  <span className="currency-amount">{formatCurrency(taxResult.total, currency)}</span>
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

function TaxLine({ label, value, color, subtle }: { label: string; value: string; color?: string; subtle?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color: subtle ? 'var(--text-subtle)' : 'var(--text-muted)', marginBottom:5 }}>
      <span>{label}</span>
      <span className="currency-amount" style={color ? { color } : {}}>{value}</span>
    </div>
  )
}
