import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Download, CheckCircle, XCircle, Edit, Trash2, Link, MessageSquare, Star, Zap, MoreVertical, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { modalState } from '../lib/modalState'
import { formatCurrency, formatDate, formatRelative, getStatusClass } from '../lib/utils'
import InvoiceModal from '../components/InvoiceModal'
import { FinancingWidget } from '../components/FeatureComponents'
import toast from 'react-hot-toast'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showFinancing, setShowFinancing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<any>(`/invoices/${id}`)
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/send`, {}),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success(data.message || 'Invoice sent!') },
    onError: (e: any) => toast.error(e.message)
  })
  const markPaidMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/mark-paid`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Marked as paid!') },
    onError: (e: any) => toast.error(e.message)
  })
  const markUnpaidMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/mark-unpaid`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Marked as unpaid') },
    onError: (e: any) => toast.error(e.message)
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/invoices/${id}`),
    onSuccess: () => { toast.success('Invoice deleted'); navigate('/invoices') },
    onError: (e: any) => toast.error(e.message)
  })
  const payLinkMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/payment-link`, {}),
    onSuccess: (data: any) => { navigator.clipboard.writeText(data.payment_link); toast.success('Payment link copied!') },
    onError: (e: any) => toast.error(e.message)
  })
  const whatsappMutation = useMutation({
    mutationFn: () => api.post(`/notify/whatsapp/${id}`, {}),
    onSuccess: (data: any) => toast.success(data.message || 'WhatsApp sent!'),
    onError: (e: any) => toast.error(e.message.includes('phone') ? 'Add a phone number to this client first' : e.message)
  })
  const smsMutation = useMutation({
    mutationFn: () => api.post(`/notify/sms/${id}`, {}),
    onSuccess: (data: any) => toast.success(data.message || 'SMS sent!'),
    onError: (e: any) => toast.error(e.message.includes('phone') ? 'Add a phone number to this client first' : e.message)
  })
  const surveyMutation = useMutation({
    mutationFn: () => api.post(`/features/satisfaction/send/${id}`, {}),
    onSuccess: (data: any) => toast.success(data.message || 'Survey sent!'),
    onError: (e: any) => toast.error(e.message)
  })
  const earlyPayMutation = useMutation({
    mutationFn: () => api.post(`/features/early-payment/${id}`, { discount_percent: 2, discount_days: 5 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Early payment discount applied!') },
    onError: (e: any) => toast.error(e.message)
  })

  if (isLoading) return <div className="page-body" style={{ paddingTop: 32, color: 'var(--text-subtle)' }}>Loading...</div>
  if (!invoice) return <div className="page-body" style={{ paddingTop: 32 }}>Invoice not found</div>

  const client = invoice.clients || {}
  const items = invoice.invoice_items || []
  const views = invoice.view_count || 0
  const isPaid = invoice.status === 'paid'

  return (
    <>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/invoices')}><ArrowLeft size={18}/></button>
          <div style={{ minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <h1 className="page-title" style={{ fontSize:18 }}>{invoice.invoice_number}</h1>
              <span className={`badge ${getStatusClass(invoice.status)}`}>{invoice.status}</span>
              {views > 0 && <span style={{ fontSize:11, color:'var(--text-subtle)' }}>viewed {views}×</span>}
            </div>
            <p className="page-subtitle">{client.name} · Due {formatDate(invoice.due_date)}</p>
          </div>
        </div>

        <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
          {/* Primary actions — always visible */}
          {!isPaid && (
            <button className="btn btn-primary" onClick={() => markPaidMutation.mutate()} disabled={markPaidMutation.isPending}>
              <CheckCircle size={14}/> Mark paid
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => api.downloadPDF(invoice.id, invoice.invoice_number).catch(e => toast.error(e.message))}>
            <Download size={14}/> PDF
          </button>
          <button className="btn btn-secondary" onClick={() => { setShowEdit(true); modalState.open() }}>
            <Edit size={14}/> Edit
          </button>

          {/* More actions dropdown */}
          <div ref={dropdownRef} style={{ position:'relative' }}>
            <button className="btn btn-secondary btn-icon" onClick={() => setShowActions(v => !v)} title="More actions">
              <MoreVertical size={16}/>
            </button>
            {showActions && (
              <div style={{
                position:'absolute', right:0, top:'calc(100% + 6px)',
                background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
                zIndex:200, minWidth:200, overflow:'hidden',
                animation:'fadeIn 0.1s ease'
              }} onClick={() => setShowActions(false)}>
                {!isPaid && <>
                  <button className="dropdown-item" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                    <Send size={13}/> Send by email
                  </button>
                  <button className="dropdown-item" onClick={() => whatsappMutation.mutate()} disabled={whatsappMutation.isPending}>
                    <MessageSquare size={13}/> Send WhatsApp
                  </button>
                  <button className="dropdown-item" onClick={() => smsMutation.mutate()} disabled={smsMutation.isPending}>
                    <Phone size={13}/> Send SMS
                  </button>
                  <button className="dropdown-item" onClick={() => payLinkMutation.mutate()} disabled={payLinkMutation.isPending}>
                    <Link size={13}/> Copy payment link
                  </button>
                </>}
                {isPaid && <>
                  <button className="dropdown-item" onClick={() => surveyMutation.mutate()} disabled={surveyMutation.isPending}>
                    <Star size={13}/> Send feedback survey
                  </button>
                  <button className="dropdown-item" style={{ color:'var(--amber)' }} onClick={() => { if(confirm('Mark this invoice as unpaid?')) markUnpaidMutation.mutate() }}>
                    <XCircle size={13}/> Mark as unpaid
                  </button>
                </>}
                {invoice.status === 'draft' && (
                  <button className="dropdown-item" style={{ color:'var(--red)' }} onClick={() => { if(confirm('Permanently delete this invoice?')) deleteMutation.mutate() }}>
                    <Trash2 size={13}/> Delete invoice
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="invoice-detail-grid" style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>
          <div className="card card-p">
            {/* Bill To + Amount */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24, paddingBottom:24, borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', marginBottom:6 }}>Bill to</div>
                <div style={{ fontWeight:700, fontSize:15 }}>{client.name}</div>
                {client.email && <div style={{ color:'var(--blue)', fontSize:13, marginTop:2 }}>{client.email}</div>}
                {client.phone && <div style={{ color:'var(--text-muted)', fontSize:13 }}>{client.phone}</div>}
                {client.address && <div style={{ color:'var(--text-subtle)', fontSize:12, marginTop:4, lineHeight:1.5 }}>{client.address}</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:30, fontWeight:800, letterSpacing:'-0.04em' }}>{formatCurrency(invoice.total, invoice.currency)}</div>
                <div style={{ fontSize:12, color:'var(--text-subtle)', marginTop:4 }}>Due {formatDate(invoice.due_date)}</div>
                {invoice.issue_date && <div style={{ fontSize:11, color:'var(--text-subtle)' }}>Issued {formatDate(invoice.issue_date)}</div>}
              </div>
            </div>

            {/* Line items */}
            <div className="table-wrapper">
              <table className="data-table" style={{ marginBottom:20 }}>
                <thead>
                  <tr>
                    <th style={{ width:'50%' }}>Description</th>
                    <th style={{ textAlign:'center' }}>Qty</th>
                    <th style={{ textAlign:'right' }}>Unit price</th>
                    <th style={{ textAlign:'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td style={{ textAlign:'center', color:'var(--text-muted)' }}>{item.quantity}</td>
                      <td style={{ textAlign:'right' }} className="currency-amount">{formatCurrency(item.unit_price, invoice.currency)}</td>
                      <td style={{ textAlign:'right' }} className="currency-amount">{formatCurrency(item.amount, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <div style={{ width:260 }}>
                <TotalRow label="Subtotal" value={formatCurrency(invoice.subtotal, invoice.currency)}/>
                {invoice.discount_amount > 0 && (
                  <TotalRow label={`Discount (${invoice.discount_percent}%)`} value={`-${formatCurrency(invoice.discount_amount, invoice.currency)}`} color="var(--red)"/>
                )}
                {invoice.discount_amount > 0 && (
                  <TotalRow label="Taxable amount" value={formatCurrency((invoice.subtotal||0) - (invoice.discount_amount||0), invoice.currency)} subtle/>
                )}
                {(invoice.tax_lines && invoice.tax_lines.length > 0)
                  ? invoice.tax_lines.map((line: any) => (
                      <TotalRow key={line.label} label={line.label} value={formatCurrency(line.amount, invoice.currency)} color="var(--blue)"/>
                    ))
                  : invoice.tax_amount > 0 && (
                      <TotalRow label={`${invoice.tax_summary_label || 'Tax'} (${invoice.tax_rate}%)`} value={formatCurrency(invoice.tax_amount, invoice.currency)} color="var(--blue)"/>
                    )
                }
                {invoice.late_fee_amount > 0 && (
                  <TotalRow label="Late fee" value={formatCurrency(invoice.late_fee_amount, invoice.currency)} color="var(--red)"/>
                )}
                <div style={{ borderTop:'2px solid var(--text)', paddingTop:10, marginTop:6, display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:16 }}>
                  <span>Total</span>
                  <span className="currency-amount">{formatCurrency(invoice.total, invoice.currency)}</span>
                </div>
              </div>
            </div>

            {/* Notes & Terms */}
            {invoice.notes && (
              <div style={{ marginTop:20, padding:14, background:'var(--bg)', borderRadius:8, fontSize:13, color:'var(--text-muted)', lineHeight:1.6 }}>
                <strong style={{ color:'var(--text)' }}>Notes:</strong> {invoice.notes}
              </div>
            )}
            {invoice.terms && (
              <div style={{ marginTop:8, padding:14, background:'var(--bg)', borderRadius:8, fontSize:12, color:'var(--text-subtle)', lineHeight:1.5 }}>
                <strong>Terms:</strong> {invoice.terms}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div>
            {/* Payment link */}
            {!isPaid && (
              <div className="card card-p" style={{ marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Payment</div>
                {invoice.stripe_payment_link ? (
                  <button className="btn btn-sm btn-secondary" style={{ width:'100%', justifyContent:'center' }}
                    onClick={() => { navigator.clipboard.writeText(invoice.stripe_payment_link); toast.success('Copied!') }}>
                    <Link size={12}/> Copy payment link
                  </button>
                ) : (
                  <button className="btn btn-sm btn-secondary" style={{ width:'100%', justifyContent:'center' }}
                    onClick={() => payLinkMutation.mutate()} disabled={payLinkMutation.isPending}>
                    <Link size={12}/> {payLinkMutation.isPending ? 'Generating...' : 'Generate payment link'}
                  </button>
                )}
              </div>
            )}

            {/* Invoice financing */}
            {!isPaid && invoice.total >= 500 && (
              <div className="card" style={{ marginBottom:12, overflow:'hidden' }}>
                {showFinancing ? (
                  <FinancingWidget invoiceId={invoice.id} invoiceTotal={invoice.total} currency={invoice.currency} onClose={() => setShowFinancing(false)}/>
                ) : (
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ fontSize:13, fontWeight:600, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                      <Zap size={14} color="#b45309"/> Get paid today
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>
                      Get 90% advanced within 24 hours
                    </div>
                    <button className="btn btn-sm" style={{ width:'100%', justifyContent:'center', background:'var(--amber-bg)', color:'var(--amber)', border:'1px solid #f59e0b' }}
                      onClick={() => setShowFinancing(true)}>
                      Get {formatCurrency(invoice.total * 0.9, invoice.currency)} now →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Early payment */}
            {!isPaid && (invoice.discount_percent || 0) === 0 && (
              <div className="card card-p" style={{ marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Early payment offer</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>Offer 2% off if paid within 5 days</div>
                <button className="btn btn-sm btn-secondary" style={{ width:'100%', justifyContent:'center' }}
                  onClick={() => earlyPayMutation.mutate()} disabled={earlyPayMutation.isPending}>
                  Apply 2% discount
                </button>
              </div>
            )}

            {/* Timeline */}
            <div className="card card-p">
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Timeline</div>
              {[
                { label:'Created', date:invoice.created_at, color:'var(--text-subtle)' },
                invoice.sent_at ? { label:'Sent to client', date:invoice.sent_at, color:'var(--blue)' } : null,
                invoice.viewed_at ? { label:`Viewed (${views}×)`, date:invoice.viewed_at, color:'var(--amber)' } : null,
                invoice.paid_at ? { label:'Payment received', date:invoice.paid_at, color:'var(--green)' } : null,
              ].filter(Boolean).map((ev: any, i) => (
                <div key={i} style={{ display:'flex', gap:10, marginBottom:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:ev.color, marginTop:5, flexShrink:0 }}/>
                  <div>
                    <div style={{ fontSize:12.5, fontWeight:500 }}>{ev.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-subtle)' }}>{formatRelative(ev.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <InvoiceModal
          invoice={invoice}
          onClose={() => { setShowEdit(false); modalState.close() }}
          onSave={() => { qc.invalidateQueries({ queryKey: ['invoice', id] }); setShowEdit(false); modalState.close() }}
        />
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </>
  )
}

function TotalRow({ label, value, color, subtle }: { label: string; value: string; color?: string; subtle?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color: subtle ? 'var(--text-subtle)' : 'var(--text-muted)', marginBottom:6 }}>
      <span>{label}</span>
      <span className="currency-amount" style={color ? { color } : {}}>{value}</span>
    </div>
  )
}
