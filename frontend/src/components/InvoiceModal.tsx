import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Trash2, X, Info } from 'lucide-react'
import { api } from '../lib/api'
import { CURRENCIES, formatCurrency } from '../lib/utils'
import {
  COUNTRY_TAX_CONFIGS,
  COUNTRY_LIST,
  CURRENCY_TO_COUNTRY,
  calculateTax,
} from '../lib/taxSystem'
import toast from 'react-hot-toast'

export default function InvoiceModal({ invoice, onClose, onSave }: { invoice?: any; onClose: () => void; onSave: () => void }) {
  const isEdit = !!invoice
  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get<any[]>('/clients') })

  const { register, control, handleSubmit, watch, setValue } = useForm({
    defaultValues: invoice
      ? {
          ...invoice,
          items: invoice.invoice_items || [{ description: '', quantity: 1, unit_price: 0 }],
          country_code: invoice.country_code || CURRENCY_TO_COUNTRY[invoice.currency] || 'GB',
          tax_type: invoice.tax_type || 'CGST_SGST',
        }
      : {
          issue_date: today,
          due_date: in30,
          currency: 'GBP',
          country_code: 'GB',
          tax_rate: 20,
          discount_percent: 0,
          tax_type: 'CGST_SGST',
          notes: '',
          terms: 'Payment due within 30 days.',
          items: [{ description: '', quantity: 1, unit_price: 0 }],
        },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const items = watch('items')
  const taxRate = watch('tax_rate')
  const currency = watch('currency')
  const discountPct = watch('discount_percent')
  const countryCode = watch('country_code')
  const taxType = watch('tax_type')

  const countryConfig = COUNTRY_TAX_CONFIGS[countryCode] || COUNTRY_TAX_CONFIGS['OTHER']

  // Auto-sync currency when country changes
  useEffect(() => {
    if (!isEdit) {
      setValue('currency', countryConfig.currency)
      setValue('tax_rate', countryConfig.defaultRate)
    }
  }, [countryCode])

  const subtotal = (items || []).reduce(
    (s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
    0
  )

  const taxResult = calculateTax(subtotal, Number(discountPct) || 0, Number(taxRate) || 0, countryCode, taxType)

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? api.put(`/invoices/${invoice.id}`, data) : api.post('/invoices', data),
    onSuccess: () => { toast.success(isEdit ? 'Updated!' : 'Invoice created!'); onSave() },
    onError: (e: any) => toast.error(e.message),
  })

  const onSubmit = (data: any) => {
    saveMutation.mutate({
      ...data,
      // Store tax breakdown for PDF and display
      tax_lines: taxResult.taxLines,
      taxable_amount: taxResult.taxableAmount,
      tax_summary_label: taxResult.taxSummaryLabel,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 780 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Edit invoice' : 'New invoice'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body">

            {/* Row 1: Client + Dates */}
            <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select {...register('client_id', { required: true })} className="form-select">
                  <option value="">Select...</option>
                  {(Array.isArray(clients) ? clients : []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Issue date</label>
                <input {...register('issue_date')} className="form-input" type="date" />
              </div>
              <div className="form-group">
                <label className="form-label">Due date</label>
                <input {...register('due_date')} className="form-input" type="date" />
              </div>
            </div>

            {/* Row 2: Country + Currency + Discount */}
            <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div className="form-group">
                <label className="form-label">Country / Tax system</label>
                <select {...register('country_code')} className="form-select">
                  {COUNTRY_LIST.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select {...register('currency')} className="form-select">
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Discount %</label>
                <input {...register('discount_percent', { valueAsNumber: true })} className="form-input" type="number" min="0" max="100" step="0.01" />
              </div>
            </div>

            {/* Tax section — adapts to country */}
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {countryConfig.taxLabel} — {countryConfig.taxSystem}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>
                  {countryConfig.country}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: countryCode === 'IN' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
                {/* Tax rate selector */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{countryConfig.taxLabel} rate</label>
                  <select
                    className="form-select"
                    value={taxRate}
                    onChange={e => setValue('tax_rate', Number(e.target.value))}
                  >
                    {countryConfig.rates.map(r => (
                      <option key={r.label} value={r.rate}>{r.label}</option>
                    ))}
                    <option value="custom">Custom...</option>
                  </select>
                </div>

                {/* Custom rate input */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Rate % (editable)</label>
                  <input
                    {...register('tax_rate', { valueAsNumber: true })}
                    className="form-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>

                {/* India: IGST vs CGST+SGST toggle */}
                {countryCode === 'IN' && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Transaction type</label>
                    <select {...register('tax_type')} className="form-select">
                      <option value="CGST_SGST">Intra-state (CGST + SGST)</option>
                      <option value="IGST">Inter-state (IGST)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Hint */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
                <Info size={12} style={{ color: 'var(--text-subtle)', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{countryConfig.uiHint}</span>
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Line items</label>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}>
                  <Plus size={12} /> Add line
                </button>
              </div>
              {fields.map((field, i) => {
                const amt = (Number(items?.[i]?.quantity) || 0) * (Number(items?.[i]?.unit_price) || 0)
                return (
                  <div key={field.id} className="line-item-row" style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 70px 36px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input {...register(`items.${i}.description`, { required: true })} className="form-input" placeholder="Description..." />
                    <input {...register(`items.${i}.quantity`, { valueAsNumber: true })} className="form-input" type="number" min="0" step="0.01" placeholder="Qty" />
                    <input {...register(`items.${i}.unit_price`, { valueAsNumber: true })} className="form-input" type="number" min="0" step="0.01" placeholder="Unit price" />
                    <span style={{ fontSize: 13, textAlign: 'right', color: 'var(--text-muted)' }} className="currency-amount">
                      {formatCurrency(amt, currency)}
                    </span>
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(i)} disabled={fields.length === 1}><Trash2 size={14} /></button>
                  </div>
                )
              })}
            </div>

            {/* Notes + Tax summary */}
            <div className="tax-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
              <div>
                <div className="form-group"><label className="form-label">Notes</label><textarea {...register('notes')} className="form-input" rows={2} style={{ resize: 'vertical' }} /></div>
                <div className="form-group"><label className="form-label">Payment terms</label><input {...register('terms')} className="form-input" /></div>
              </div>

              {/* Live tax breakdown */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                  {countryConfig.taxSystem} Breakdown
                </div>

                <TaxLine label="Subtotal" value={formatCurrency(taxResult.subtotal, currency)} />

                {taxResult.discountAmount > 0 && (
                  <TaxLine
                    label={`Discount (${discountPct}%)`}
                    value={`-${formatCurrency(taxResult.discountAmount, currency)}`}
                    color="#e74c3c"
                  />
                )}

                {taxResult.discountAmount > 0 && (
                  <TaxLine
                    label="Taxable amount"
                    value={formatCurrency(taxResult.taxableAmount, currency)}
                    subtle
                  />
                )}

                {taxResult.taxLines.map(line => (
                  <TaxLine
                    key={line.label}
                    label={line.label}
                    value={formatCurrency(line.amount, currency)}
                    color="var(--blue)"
                  />
                ))}

                {taxRate === 0 && (
                  <TaxLine label={`${countryConfig.taxLabel} (0%)`} value="Exempt" subtle />
                )}

                <div style={{ borderTop: '2px solid var(--text)', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                  <span>Total</span>
                  <span className="currency-amount">{formatCurrency(taxResult.total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update invoice' : 'Create invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TaxLine({ label, value, color, subtle }: { label: string; value: string; color?: string; subtle?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: subtle ? 'var(--text-subtle)' : 'var(--text-muted)', marginBottom: 5 }}>
      <span>{label}</span>
      <span className="currency-amount" style={color ? { color } : {}}>{value}</span>
    </div>
  )
}
