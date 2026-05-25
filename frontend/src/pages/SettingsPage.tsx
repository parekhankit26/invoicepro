import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { CURRENCIES } from '../lib/utils'
import { COUNTRY_LIST, COUNTRY_TAX_CONFIGS, CURRENCY_TO_COUNTRY } from '../lib/taxSystem'
import toast from 'react-hot-toast'

const LS_BANK_KEY = 'invoicepro_bank_details'
function loadLocalBank() { try { const s = localStorage.getItem(LS_BANK_KEY); return s ? JSON.parse(s) : null } catch { return null } }
function saveLocalBank(b: any) { try { localStorage.setItem(LS_BANK_KEY, JSON.stringify(b)) } catch {} }

export default function SettingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
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
          <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

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
              <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
                        : <button type="button" className="btn btn-sm btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/enterprise')}>Upgrade</button>
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

        {/* Payment details — must be OUTSIDE the main form to avoid nested-form bug */}
        <div className="card card-p" style={{ marginTop: 16 }}>
          <PaymentDetailsSection profile={profile} />
        </div>

        {/* Password Change */}
        <div className="card card-p" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Change password</div>
          <PasswordChangeForm />
        </div>
      </div>
    </>
  )
}


function PaymentDetailsSection({ profile }: { profile: any }) {
  const qc = useQueryClient()

  const blank = { account_holder_name: '', bank_name: '', account_number: '', sort_code: '', iban: '', swift_bic: '', payment_instructions: '' }
  const [form, setForm] = useState(blank)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  // Populate form once: prefer localStorage, then DB/metadata value
  useEffect(() => {
    if (loaded) return // only run once
    const local = loadLocalBank()
    const fromDb = (() => { try { const raw = profile?.bank_account_details; if (!raw) return null; return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null } })()
    const src = local || fromDb
    if (src) {
      setForm({
        account_holder_name:  src.account_holder_name  || '',
        bank_name:            src.bank_name            || '',
        account_number:       src.account_number       || '',
        sort_code:            src.sort_code            || '',
        iban:                 src.iban                 || '',
        swift_bic:            src.swift_bic            || '',
        payment_instructions: src.payment_instructions || '',
      })
      setLoaded(true)
    } else if (profile !== undefined) {
      // profile loaded but no bank details yet — mark as loaded so we don't loop
      setLoaded(true)
    }
  }, [profile, loaded])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    saveLocalBank(form)
    try {
      await api.put('/auth/profile', { bank_account_details: JSON.stringify(form) })
      qc.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Payment details saved!')
    } catch {
      toast.success('Payment details saved locally!')
    } finally { setSaving(false) }
  }

  const f = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  })

  return (
    <form onSubmit={handleSave}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Payment details</div>
      <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginBottom: 16 }}>
        These appear on every invoice PDF and in the client portal, so clients know exactly how to pay you.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Account holder name</label>
          <input {...f('account_holder_name')} className="form-input" placeholder="Asproite Ltd" />
        </div>
        <div className="form-group">
          <label className="form-label">Bank name</label>
          <input {...f('bank_name')} className="form-input" placeholder="Barclays Bank" />
        </div>
        <div className="form-group">
          <label className="form-label">Account number</label>
          <input {...f('account_number')} className="form-input" placeholder="12345678" />
        </div>
        <div className="form-group">
          <label className="form-label">Sort code <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(UK)</span></label>
          <input {...f('sort_code')} className="form-input" placeholder="20-00-00" />
        </div>
        <div className="form-group">
          <label className="form-label">IBAN <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(international)</span></label>
          <input {...f('iban')} className="form-input" placeholder="GB29 NWBK 6016 1331 9268 19" />
        </div>
        <div className="form-group">
          <label className="form-label">SWIFT / BIC</label>
          <input {...f('swift_bic')} className="form-input" placeholder="NWBKGB2L" />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Additional payment instructions <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(optional)</span></label>
          <textarea {...(f('payment_instructions') as any)} className="form-input" rows={2} style={{ resize: 'vertical' }} placeholder="e.g. Please use the invoice number as payment reference. Payments typically clear within 1 business day." />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save payment details'}
        </button>
      </div>
    </form>
  )
}

function PasswordChangeForm() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.next !== form.confirm) { toast.error('New passwords do not match'); return }
    if (form.next.length < 8) { toast.error('New password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const { supabase: supa } = await import('../lib/supabase')
      const { error } = await supa.auth.updateUser({ password: form.next })
      if (error) throw error
      toast.success('Password updated successfully!')
      setForm({ current: '', next: '', confirm: '' })
    } catch(e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleChange}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }} className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Current password</label>
          <input className="form-input" type="password" value={form.current} onChange={e => setForm(p => ({...p, current: e.target.value}))} placeholder="Current password"/>
        </div>
        <div className="form-group">
          <label className="form-label">New password</label>
          <input className="form-input" type="password" value={form.next} onChange={e => setForm(p => ({...p, next: e.target.value}))} placeholder="8+ characters"/>
        </div>
        <div className="form-group">
          <label className="form-label">Confirm new password</label>
          <input className="form-input" type="password" value={form.confirm} onChange={e => setForm(p => ({...p, confirm: e.target.value}))} placeholder="Repeat new password"/>
        </div>
      </div>
      <button type="submit" className="btn btn-secondary" disabled={loading || !form.next || !form.confirm}>
        {loading ? 'Updating...' : 'Update password'}
      </button>
    </form>
  )
}
