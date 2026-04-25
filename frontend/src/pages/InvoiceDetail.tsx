import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Download, CheckCircle, Edit, Trash2, Link, MessageSquare, Star, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate, formatRelative, getStatusClass } from '../lib/utils'
import InvoiceModal from '../components/InvoiceModal'
import { FinancingWidget } from '../components/FeatureComponents'
import toast from 'react-hot-toast'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showFinancing, setShowFinancing] = useState(false)

  const { data: invoice, isLoading } = useQuery({ queryKey: ['invoice', id], queryFn: () => api.get<any>(`/invoices/${id}`) })

  const sendMutation = useMutation({ mutationFn: () => api.post(`/invoices/${id}/send`, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Invoice sent!') }, onError: (e: any) => toast.error(e.message) })
  const markPaidMutation = useMutation({ mutationFn: () => api.post(`/invoices/${id}/mark-paid`, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Marked as paid!') }, onError: (e: any) => toast.error(e.message) })
  const deleteMutation = useMutation({ mutationFn: () => api.delete(`/invoices/${id}`), onSuccess: () => { toast.success('Deleted'); navigate('/invoices') } })
  const payLinkMutation = useMutation({ mutationFn: () => api.post(`/invoices/${id}/payment-link`, {}), onSuccess: (data: any) => { navigator.clipboard.writeText(data.payment_link); toast.success('Payment link copied!') }, onError: (e: any) => toast.error(e.message) })
  const whatsappMutation = useMutation({ mutationFn: () => api.post(`/notify/whatsapp/${id}`, {}), onSuccess: (data: any) => toast.success(data.message), onError: (e: any) => toast.error(e.message) })
  const smsMutation = useMutation({ mutationFn: () => api.post(`/notify/sms/${id}`, {}), onSuccess: (data: any) => toast.success(data.message), onError: (e: any) => toast.error(e.message) })
  const surveyMutation = useMutation({ mutationFn: () => api.post(`/features/satisfaction/send/${id}`, {}), onSuccess: (data: any) => toast.success(data.message), onError: (e: any) => toast.error(e.message) })
  const earlyPayMutation = useMutation({ mutationFn: () => api.post(`/features/early-payment/${id}`, { discount_percent: 2, discount_days: 5 }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Early payment discount applied!') }, onError: (e: any) => toast.error(e.message) })

  if (isLoading) return <div className="page-body" style={{ paddingTop: 32, color: 'var(--text-subtle)' }}>Loading...</div>
  if (!invoice) return <div className="page-body" style={{ paddingTop: 32 }}>Invoice not found</div>

  const client = invoice.clients || {}
  const items = invoice.invoice_items || []
  const views = invoice.view_count || 0

  return (
    <>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/invoices')}><ArrowLeft size={18} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 className="page-title">{invoice.invoice_number}</h1>
              <span className={`badge ${getStatusClass(invoice.status)}`}>{invoice.status}</span>
              {views > 0 && <span style={{ fontSize:11, color:'var(--text-subtle)' }}>viewed {views}×</span>}
            </div>
            <p className="page-subtitle">{client.name} · Due {formatDate(invoice.due_date)}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {invoice.status !== 'paid' && <button className="btn btn-secondary" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}><Send size={14} /> Send email</button>}
          {invoice.status !== 'paid' && <button className="btn btn-secondary" onClick={() => whatsappMutation.mutate()} disabled={whatsappMutation.isPending} title="Send WhatsApp reminder"><MessageSquare size={14} /> WhatsApp</button>}
          {invoice.status !== 'paid' && <button className="btn btn-secondary" onClick={() => smsMutation.mutate()} disabled={smsMutation.isPending} title="Send SMS">SMS</button>}
          {invoice.status !== 'paid' && <button className="btn btn-secondary" onClick={() => markPaidMutation.mutate()}><CheckCircle size={14} /> Mark paid</button>}
          {invoice.status === 'paid' && <button className="btn btn-secondary" onClick={() => surveyMutation.mutate()} disabled={surveyMutation.isPending}><Star size={14} /> Send survey</button>}
          <button className="btn btn-secondary" onClick={() => api.downloadPDF(invoice.id, invoice.invoice_number).catch(e => toast.error(e.message))}><Download size={14} /> PDF</button>
          <button className="btn btn-secondary" onClick={() => setShowEdit(true)}><Edit size={14} /> Edit</button>
          {invoice.status === 'draft' && <button className="btn btn-danger" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate() }}><Trash2 size={14} /></button>}
        </div>
      </div>

      <div className="page-body">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>
          <div className="card card-p">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24, paddingBottom:24, borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-subtle)', marginBottom:6 }}>Bill to</div>
                <div style={{ fontWeight:600, fontSize:15 }}>{client.name}</div>
                {client.email && <div style={{ color:'var(--blue)', fontSize:13 }}>{client.email}</div>}
                {client.phone && <div style={{ color:'var(--text-muted)', fontSize:13 }}>{client.phone}</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:28, fontWeight:700 }}>{formatCurrency(invoice.total, invoice.currency)}</div>
                <div style={{ fontSize:12, color:'var(--text-subtle)', marginTop:4 }}>Due {formatDate(invoice.due_date)}</div>
              </div>
            </div>

            <table className="data-table" style={{ marginBottom:16 }}>
              <thead><tr><th style={{ width:'50%' }}>Description</th><th style={{ textAlign:'center' }}>Qty</th><th style={{ textAlign:'right' }}>Price</th><th style={{ textAlign:'right' }}>Amount</th></tr></thead>
              <tbody>{items.map((item: any) => (
                <tr key={item.id}><td>{item.description}</td><td style={{ textAlign:'center', color:'var(--text-muted)' }}>{item.quantity}</td><td style={{ textAlign:'right' }} className="currency-amount">{formatCurrency(item.unit_price, invoice.currency)}</td><td style={{ textAlign:'right' }} className="currency-amount">{formatCurrency(item.amount, invoice.currency)}</td></tr>
              ))}</tbody>
            </table>

            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <div style={{ width:240 }}>
                {[['Subtotal', invoice.subtotal], invoice.discount_amount > 0 ? ['Discount', -invoice.discount_amount] : null, invoice.tax_amount > 0 ? [`VAT (${invoice.tax_rate}%)`, invoice.tax_amount] : null, invoice.late_fee_amount > 0 ? ['Late fee', invoice.late_fee_amount] : null].filter(Boolean).map(([l, v]: any) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-muted)', marginBottom:6 }}><span>{l}</span><span className="currency-amount">{v < 0 ? '-' : ''}{formatCurrency(Math.abs(v), invoice.currency)}</span></div>
                ))}
                <div style={{ borderTop:'2px solid var(--text)', paddingTop:10, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:15 }}><span>Total</span><span className="currency-amount">{formatCurrency(invoice.total, invoice.currency)}</span></div>
              </div>
            </div>

            {invoice.notes && <div style={{ marginTop:20, padding:14, background:'var(--bg)', borderRadius:8, fontSize:13, color:'var(--text-muted)' }}><strong>Notes:</strong> {invoice.notes}</div>}
          </div>

          <div>
            {/* Payment Link */}
            {invoice.status !== 'paid' && (
              <div className="card card-p" style={{ marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Payment link</div>
                {invoice.stripe_payment_link ? (
                  <button className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center' }} onClick={() => { navigator.clipboard.writeText(invoice.stripe_payment_link); toast.success('Copied!') }}><Link size={12} /> Copy Stripe link</button>
                ) : (
                  <button className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center' }} onClick={() => payLinkMutation.mutate()} disabled={payLinkMutation.isPending}><Link size={12} /> Generate payment link</button>
                )}
              </div>
            )}

            {/* Get Paid Now - Financing */}
            {invoice.status !== 'paid' && invoice.total >= 500 && (
              <div className="card" style={{ marginBottom:12, overflow:'hidden' }}>
                {showFinancing ? (
                  <FinancingWidget invoiceId={invoice.id} invoiceTotal={invoice.total} currency={invoice.currency} onClose={() => setShowFinancing(false)} />
                ) : (
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ fontSize:13, fontWeight:600, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}><Zap size={14} color="#b45309" /> Get paid today</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>Don't wait. Get 90% of this invoice advanced within 24 hours.</div>
                    <button className="btn btn-sm" style={{ width:'100%', justifyContent:'center', background:'var(--amber-bg)', color:'var(--amber)', border:'1px solid', borderColor:'#f59e0b' }} onClick={() => setShowFinancing(true)}>Get {formatCurrency(invoice.total * 0.9, invoice.currency)} now →</button>
                  </div>
                )}
              </div>
            )}

            {/* Early payment discount */}
            {invoice.status !== 'paid' && invoice.discount_percent === 0 && (
              <div className="card card-p" style={{ marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Early payment discount</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>Offer 2% off if paid within 5 days</div>
                <button className="btn btn-sm btn-secondary" style={{ width:'100%', justifyContent:'center' }} onClick={() => earlyPayMutation.mutate()} disabled={earlyPayMutation.isPending}>Apply 2% early discount</button>
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
                <div key={i} style={{ display:'flex', gap:10, marginBottom:10 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:ev.color, marginTop:5, flexShrink:0 }} />
                  <div><div style={{ fontSize:12.5, fontWeight:500 }}>{ev.label}</div><div style={{ fontSize:11, color:'var(--text-subtle)' }}>{formatRelative(ev.date)}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showEdit && <InvoiceModal invoice={invoice} onClose={() => setShowEdit(false)} onSave={() => { qc.invalidateQueries({ queryKey: ['invoice', id] }); setShowEdit(false) }} />}
    </>
  )
}
