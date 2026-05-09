import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { CURRENCIES } from '../lib/utils'
import { COUNTRY_LIST, COUNTRY_TAX_CONFIGS, CURRENCY_TO_COUNTRY } from '../lib/taxSystem'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })
  const { register, handleSubmit, reset, watch, setValue } = useForm()

  useEffect(() => {
    if (profile) reset({
      ...profile,
      country_code: profile.country_code || CURRENCY_TO_COUNTRY[profile.default_currency] || 'GB',
    })
  }, [profile, reset])

  const countryCode = watch('country_code') || 'GB'
  const countryConfig = COUNTRY_TAX_CONFIGS[countryCode] || COUNTRY_TAX_CONFIGS['OTHER']

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put('/auth/profile', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Settings saved!') },
    onError: (e: any) => toast.error(e.message)
  })

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage your account & defaults</p></div>
      </div>
      <div className="page-body">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Personal Info */}
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Personal info</div>
              <div className="form-group"><label className="form-label">Full name</label><input {...register('full_name')} className="form-input" placeholder="Your name" /></div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input value={profile?.email || ''} className="form-input" disabled style={{ background: 'var(--bg)', color: 'var(--text-subtle)' }} />
                <div className="form-hint">Cannot be changed here</div>
              </div>
            </div>

            {/* Company Details */}
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Company details</div>
              <div className="form-group"><label className="form-label">Company name</label><input {...register('company_name')} className="form-input" placeholder="Acme Ltd" /></div>
              <div className="form-group"><label className="form-label">Website</label><input {...register('company_website')} className="form-input" placeholder="https://..." /></div>
              <div className="form-group"><label className="form-label">Phone</label><input {...register('company_phone')} className="form-input" /></div>
              <div className="form-group">
                <label className="form-label">{countryConfig.taxLabel} / Tax registration number</label>
                <input {...register('tax_number')} className="form-input" placeholder={
                  countryCode === 'GB' ? 'GB 123456789' :
                  countryCode === 'IN' ? 'e.g. 22AAAAA0000A1Z5 (GSTIN)' :
                  countryCode === 'US' ? 'EIN: XX-XXXXXXX' :
                  countryCode === 'AU' ? 'ABN: XX XXX XXX XXX' :
                  countryCode === 'DE' ? 'DE 123456789' :
                  `${countryConfig.taxLabel} number`
                } />
              </div>
              <div className="form-group"><label className="form-label">Address</label><textarea {...register('company_address')} className="form-input" rows={2} style={{ resize: 'vertical' }} /></div>
            </div>

            {/* Invoice Defaults */}
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Invoice defaults</div>
              <div className="form-group">
                <label className="form-label">Your country / Tax system</label>
                <select {...register('country_code')} className="form-select" onChange={e => {
                  const cfg = COUNTRY_TAX_CONFIGS[e.target.value]
                  if (cfg) {
                    setValue('country_code', e.target.value)
                    setValue('default_currency', cfg.currency)
                    setValue('default_tax_rate', cfg.defaultRate)
                  }
                }}>
                  {COUNTRY_LIST.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <div className="form-hint">{countryConfig.description}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Default currency</label>
                  <select {...register('default_currency')} className="form-select">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Default {countryConfig.taxLabel} %</label>
                  <select {...register('default_tax_rate', { valueAsNumber: true })} className="form-select">
                    {countryConfig.rates.map(r => <option key={r.label} value={r.rate}>{r.label}</option>)}
                  </select>
                  <div className="form-hint">{countryConfig.uiHint}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment terms (days)</label>
                  <input {...register('default_payment_terms', { valueAsNumber: true })} className="form-input" type="number" min="0" />
                </div>
              </div>
            </div>

            {/* Subscription */}
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Subscription plan</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { plan: 'free',       label: 'Free',       price: '£0/mo',  features: '5 invoices/mo' },
                  { plan: 'starter',    label: 'Starter',    price: '£9/mo',  features: 'Unlimited invoices' },
                  { plan: 'pro',        label: 'Pro',        price: '£19/mo', features: 'AI + all features' },
                  { plan: 'enterprise', label: 'Enterprise', price: '£49/mo', features: 'White label + API' },
                ].map(({ plan, label, price, features }) => {
                  const active = profile?.plan === plan || (!profile?.plan && plan === 'free')
                  return (
                    <div key={plan} style={{ border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, borderRadius: 10, padding: 14, background: active ? 'var(--bg)' : 'transparent' }}>
                      <div style={{ fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0' }}>{price}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 8 }}>{features}</div>
                      {active
                        ? <span className="badge badge-paid">Current plan</span>
                        : <button type="button" className="btn btn-sm btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => toast('Contact us to upgrade your plan')}>Upgrade</button>
                      }
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Notification preferences */}
            <div className="card card-p" style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Notifications & reminders</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { key: 'notify_on_view', label: 'Invoice viewed', desc: 'Alert when client opens invoice' },
                  { key: 'notify_on_payment', label: 'Payment received', desc: 'Alert when invoice is paid' },
                  { key: 'auto_reminders', label: 'Auto payment reminders', desc: 'Send reminders for overdue invoices' },
                ].map(({ key, label, desc }) => (
                  <label key={key} style={{ display: 'flex', gap: 12, padding: 14, background: 'var(--bg)', borderRadius: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
                    <input {...register(key)} type="checkbox" style={{ width: 'auto', marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
