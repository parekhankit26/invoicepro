import { useForm, useFieldArray } from 'react-hook-form'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { CURRENCIES, formatCurrency } from '../lib/utils'
import toast from 'react-hot-toast'

export default function InvoiceModal({ invoice, onClose, onSave }: { invoice?: any; onClose: () => void; onSave: () => void }) {
  const isEdit = !!invoice
  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get<any[]>('/clients') })
  const { register, control, handleSubmit, watch } = useForm({
    defaultValues: invoice ? { ...invoice, items: invoice.invoice_items || [{ description: '', quantity: 1, unit_price: 0 }] } : { issue_date: today, due_date: in30, currency: 'GBP', tax_rate: 20, discount_percent: 0, notes: '', terms: 'Payment due within 30 days.', items: [{ description: '', quantity: 1, unit_price: 0 }] }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items'); const taxRate = watch('tax_rate'); const currency = watch('currency'); const discountPct = watch('discount_percent')
  const subtotal = (items || []).reduce((s: number, i: any) => s + (Number(i.quantity)||0) * (Number(i.unit_price)||0), 0)
  const discountAmt = subtotal * ((Number(discountPct)||0) / 100)
  const taxAmt = (subtotal - discountAmt) * ((Number(taxRate)||0) / 100)
  const total = subtotal - discountAmt + taxAmt
  const saveMutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.put(`/invoices/${invoice.id}`, data) : api.post('/invoices', data),
    onSuccess: () => { toast.success(isEdit ? 'Updated!' : 'Invoice created!'); onSave() },
    onError: (e: any) => toast.error(e.message)
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 700 }}>
        <div className="modal-header"><h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Edit invoice' : 'New invoice'}</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group"><label className="form-label">Client *</label><select {...register('client_id', { required: true })} className="form-select"><option value="">Select...</option>{(Array.isArray(clients) ? clients : []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Issue date</label><input {...register('issue_date')} className="form-input" type="date" /></div>
              <div className="form-group"><label className="form-label">Due date</label><input {...register('due_date')} className="form-input" type="date" /></div>
              <div className="form-group"><label className="form-label">Currency</label><select {...register('currency')} className="form-select">{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Tax %</label><input {...register('tax_rate', { valueAsNumber: true })} className="form-input" type="number" min="0" /></div>
              <div className="form-group"><label className="form-label">Discount %</label><input {...register('discount_percent', { valueAsNumber: true })} className="form-input" type="number" min="0" /></div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Line items</label>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}><Plus size={12} /> Add</button>
              </div>
              {fields.map((field, i) => {
                const amt = (Number(items?.[i]?.quantity)||0) * (Number(items?.[i]?.unit_price)||0)
                return (
                  <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 120px 36px', gap: 8, marginBottom: 6 }}>
                    <input {...register(`items.${i}.description`, { required: true })} className="form-input" placeholder="Description..." />
                    <input {...register(`items.${i}.quantity`, { valueAsNumber: true })} className="form-input" type="number" min="0" step="0.01" />
                    <input {...register(`items.${i}.unit_price`, { valueAsNumber: true })} className="form-input" type="number" min="0" step="0.01" placeholder="0.00" />
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(i)} disabled={fields.length === 1}><Trash2 size={14} /></button>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16 }}>
              <div>
                <div className="form-group"><label className="form-label">Notes</label><textarea {...register('notes')} className="form-input" rows={2} style={{ resize: 'vertical' }} /></div>
                <div className="form-group"><label className="form-label">Terms</label><input {...register('terms')} className="form-input" /></div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16 }}>
                {[['Subtotal', formatCurrency(subtotal, currency)], discountAmt > 0 ? [`Discount (${discountPct}%)`, `-${formatCurrency(discountAmt, currency)}`] : null, taxAmt > 0 ? [`Tax (${taxRate}%)`, formatCurrency(taxAmt, currency)] : null].filter(Boolean).map(([l, v]: any) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}><span>{l}</span><span className="currency-amount">{v}</span></div>
                ))}
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}><span>Total</span><span className="currency-amount">{formatCurrency(total, currency)}</span></div>
              </div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create invoice'}</button></div>
        </form>
      </div>
    </div>
  )
}
