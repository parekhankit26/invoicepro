import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { openExternalUrl } from '../lib/iosUtils'
import { CURRENCIES } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/authStore'
import toast from 'react-hot-toast'
import { Trash2, X } from 'lucide-react'

export default function SettingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })
  const { register, handleSubmit, reset } = useForm()
  useEffect(() => { if (profile) reset(profile) }, [profile, reset])
  const saveMutation = useMutation({ mutationFn: (data: any) => api.put('/auth/profile', data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Settings saved!') }, onError: (e: any) => toast.error(e.message) })
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/auth/account'),
    onSuccess: async () => {
      toast.success('Account deleted')
      await supabase.auth.signOut()
      setUser(null)
      navigate('/auth', { replace: true })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const handleUpgrade = async (plan: string) => {
    setUpgradingPlan(plan)
    try {
      const data: any = await api.post('/auth/upgrade', { plan: plan.toLowerCase() })
      if (data?.url) {
        openExternalUrl(data.url)
      } else {
        toast('To upgrade, visit invoicepro.asproite.com from your browser', { icon: '🔗' })
      }
    } catch {
      toast('To upgrade your plan, please visit invoicepro.asproite.com from Safari', { icon: '🔗', duration: 5000 })
    } finally {
      setUpgradingPlan(null)
    }
  }

  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage your account</p></div></div>
      <div className="page-body">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
          <div className="grid-2col">
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
              <div className="grid-3col">
                <div className="form-group"><label className="form-label">Default currency</label><select {...register('default_currency')} className="form-select">{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Tax rate (%)</label><input {...register('default_tax_rate', { valueAsNumber: true })} className="form-input" type="number" min="0" max="100" /><div className="form-hint">UK standard VAT is 20%</div></div>
                <div className="form-group"><label className="form-label">Payment terms (days)</label><input {...register('default_payment_terms', { valueAsNumber: true })} className="form-input" type="number" min="0" /></div>
              </div>
            </div>
            <div className="card card-p">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Subscription plan</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[{ plan: 'Free', price: '£0/mo', key: 'free', active: profile?.plan === 'free' || !profile?.plan },{ plan: 'Starter', price: '£9/mo', key: 'starter', active: profile?.plan === 'starter' },{ plan: 'Pro', price: '£19/mo', key: 'pro', active: profile?.plan === 'pro' },{ plan: 'Enterprise', price: '£49/mo', key: 'enterprise', active: profile?.plan === 'enterprise' }].map(({ plan, price, key, active }) => (
                  <div key={plan} style={{ border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700 }}>{plan}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, margin: '6px 0' }}>{price}</div>
                    {active ? <span className="badge badge-paid">Current plan</span> : (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                        disabled={upgradingPlan === key}
                        onClick={() => handleUpgrade(key)}
                      >
                        {upgradingPlan === key ? 'Opening...' : 'Upgrade'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save settings'}</button>
          </div>
        </form>

        <div className="card card-p" style={{ marginTop: 16, borderColor: 'var(--red)', borderWidth: 1, borderStyle: 'solid' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--red)' }}>Danger zone</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Permanently delete your account and all associated data. This action cannot be undone.</div>
          <button type="button" className="btn btn-danger" onClick={() => setShowDeleteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={14} /> Delete my account
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDeleteModal(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--red)' }}>Delete account</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDeleteModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                This will permanently delete your account, all invoices, clients, expenses, and data. <strong>This cannot be undone.</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Type <strong>DELETE</strong> to confirm</label>
                <input className="form-input" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" autoCapitalize="characters" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={deleteConfirm !== 'DELETE' || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete account permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
