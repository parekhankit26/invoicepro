import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { CURRENCIES } from '../lib/utils'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })
  const { register, handleSubmit, reset } = useForm()
  useEffect(() => { if (profile) reset(profile) }, [profile, reset])
  const saveMutation = useMutation({ mutationFn: (data: any) => api.put('/auth/profile', data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Settings saved!') }, onError: (e: any) => toast.error(e.message) })

  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage your account</p></div></div>
      <div className="page-body">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Personal info</div>
              <div className="form-group"><label className="form-label">Full name</label><input {...register('full_name')} className="form-input" placeholder="Your name" /></div>
              <div className="form-group"><label className="form-label">Email</label><input value={profile?.email || ''} className="form-input" disabled style={{ background: 'var(--bg)', color: 'var(--text-subtle)' }} /><div className="form-hint">Cannot be changed here</div></div>
            </div>
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Company details</div>
              <div className="form-group"><label className="form-label">Company name</label><input {...register('company_name')} className="form-input" placeholder="Acme Ltd" /></div>
              <div className="form-group"><label className="form-label">Website</label><input {...register('company_website')} className="form-input" placeholder="https://..." /></div>
              <div className="form-group"><label className="form-label">Phone</label><input {...register('company_phone')} className="form-input" /></div>
              <div className="form-group"><label className="form-label">VAT number</label><input {...register('tax_number')} className="form-input" placeholder="GB 123456789" /></div>
              <div className="form-group"><label className="form-label">Address</label><textarea {...register('company_address')} className="form-input" rows={2} style={{ resize: 'vertical' }} /></div>
            </div>
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Invoice defaults</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Default currency</label><select {...register('default_currency')} className="form-select">{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Tax rate (%)</label><input {...register('default_tax_rate', { valueAsNumber: true })} className="form-input" type="number" min="0" max="100" /><div className="form-hint">UK standard VAT is 20%</div></div>
                <div className="form-group"><label className="form-label">Payment terms (days)</label><input {...register('default_payment_terms', { valueAsNumber: true })} className="form-input" type="number" min="0" /></div>
              </div>
            </div>
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Subscription plan</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[{ plan: 'Free', price: '£0/mo', active: profile?.plan === 'free' || !profile?.plan },{ plan: 'Starter', price: '£9/mo', active: profile?.plan === 'starter' },{ plan: 'Pro', price: '£19/mo', active: profile?.plan === 'pro' },{ plan: 'Enterprise', price: '£49/mo', active: profile?.plan === 'enterprise' }].map(({ plan, price, active }) => (
                  <div key={plan} style={{ border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700 }}>{plan}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, margin: '6px 0' }}>{price}</div>
                    {active ? <span className="badge badge-paid">Current plan</span> : <button type="button" className="btn btn-sm btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>Upgrade</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save settings'}</button>
          </div>
        </form>
      </div>
    </>
  )
}
