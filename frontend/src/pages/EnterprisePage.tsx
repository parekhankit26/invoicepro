import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Key, Users, Globe, FileText, Download, Plus, Trash2, Copy, X, Shield } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'team', label: 'Team members', icon: Users },
  { id: 'apikeys', label: 'API keys', icon: Key },
  { id: 'whitelabel', label: 'White label', icon: Globe },
  { id: 'tax', label: 'Tax reports', icon: FileText },
]

export default function EnterprisePage() {
  const [tab, setTab] = useState('team')
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })
  const plan = profile?.plan || 'free'

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Enterprise features</h1>
          <p className="page-subtitle">Team, API access, white label & tax reports</p>
        </div>
        <span className="badge" style={{
          background: plan === 'enterprise' ? 'var(--accent-dim)' : 'var(--bg)',
          color: plan === 'enterprise' ? 'var(--green)' : 'var(--text-muted)',
          border: '1px solid', borderColor: plan === 'enterprise' ? 'var(--green)' : 'var(--border)',
          padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600
        }}>
          {plan.toUpperCase()} plan
        </span>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: tab === t.id ? 'var(--text)' : 'var(--text-muted)', borderBottom: tab === t.id ? '2px solid var(--text)' : '2px solid transparent', marginBottom: -1, fontFamily: 'inherit' }}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {tab === 'team' && <TeamTab plan={plan} />}
        {tab === 'apikeys' && <ApiKeysTab plan={plan} />}
        {tab === 'whitelabel' && <WhiteLabelTab plan={plan} />}
        {tab === 'tax' && <TaxReportTab />}
      </div>
    </>
  )
}

// ── TEAM TAB ─────────────────────────────────────────────
function TeamTab({ plan }: { plan: string }) {
  const qc = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const { data: members = [], isLoading } = useQuery({ queryKey: ['team'], queryFn: () => api.get<any[]>('/team') })
  const { register, handleSubmit, reset } = useForm()

  const inviteMutation = useMutation({
    mutationFn: (data: any) => api.post('/team/invite', data),
    onSuccess: (data: any) => { 
      qc.invalidateQueries({ queryKey: ['team'] })
      const inviteUrl = data.invite_url || ''
      if (inviteUrl) {
        navigator.clipboard.writeText(inviteUrl).catch(() => {})
        toast.success(`Invite sent! Link copied to clipboard`)
      } else {
        toast.success('Invite sent!')
      }
      reset(); setShowInvite(false)
    },
    onError: (e: any) => toast.error(e.message)
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast.success('Member removed') },
    onError: (e: any) => toast.error(e.message)
  })

  const canInvite = ['pro', 'enterprise'].includes(plan)

  if (!canInvite) return (
    <div className="card card-p" style={{ textAlign: 'center', padding: 40 }}>
      <Shield size={32} style={{ margin: '0 auto 16px', color: 'var(--text-subtle)' }} />
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Team members require Pro or Enterprise</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upgrade to add team members with role-based access</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{Array.isArray(members) ? members.length : 0} team members</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}><Plus size={13} /> Invite member</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? <div className="empty-state">Loading...</div> :
        !Array.isArray(members) || members.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontWeight: 500, marginBottom: 4 }}>No team members yet</div>
            <div style={{ fontSize: 13 }}>Invite your team to collaborate</div>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.full_name || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.email}</td>
                  <td><span className="badge badge-sent">{m.role}</span></td>
                  <td><span className={`badge ${m.status === 'active' ? 'badge-paid' : m.status === 'pending' ? 'badge-pending' : 'badge-draft'}`}>{m.status}</span></td>
                  <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{m.joined_at ? formatDate(m.joined_at) : 'Pending'}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => { if (confirm('Remove this team member?')) removeMutation.mutate(m.id) }}><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Invite team member</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowInvite(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit(d => inviteMutation.mutate(d))}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Email *</label><input {...register('email', { required: true })} className="form-input" type="email" placeholder="colleague@company.com" /></div>
                <div className="form-group"><label className="form-label">Name</label><input {...register('full_name')} className="form-input" placeholder="Full name" /></div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select {...register('role')} className="form-select">
                    <option value="staff">Staff — create & manage invoices</option>
                    <option value="manager">Manager — all + approve before send</option>
                    <option value="accountant">Accountant — view reports only</option>
                    <option value="admin">Admin — full access</option>
                    <option value="viewer">Viewer — read only</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={inviteMutation.isPending}>{inviteMutation.isPending ? 'Sending...' : 'Send invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── API KEYS TAB ─────────────────────────────────────────
function ApiKeysTab({ plan }: { plan: string }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const { data: keys = [], isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: () => api.get<any[]>('/enterprise/api-keys') })
  const { register, handleSubmit, reset } = useForm({ defaultValues: { name: '', permissions: ['invoices:read', 'invoices:write', 'clients:read'] } })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/enterprise/api-keys', data),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ['api-keys'] }); setNewKey(data.api_key); reset(); setShowCreate(false) },
    onError: (e: any) => toast.error(e.message)
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/enterprise/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('API key revoked') }
  })

  if (plan !== 'enterprise') return (
    <div className="card card-p" style={{ textAlign: 'center', padding: 40 }}>
      <Key size={32} style={{ margin: '0 auto 16px', color: 'var(--text-subtle)' }} />
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>API access requires Enterprise plan</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Create invoices programmatically, integrate with your own systems</div>
    </div>
  )

  return (
    <div>
      {newKey && (
        <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>✓ API key created — save it now, it won't be shown again</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, background: 'white', padding: '8px 12px', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>{newKey}</code>
            <button className="btn btn-sm btn-secondary" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied!') }}><Copy size={12} /></button>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setNewKey(null)}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={13} /> Create API key</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? <div className="empty-state">Loading...</div> :
        !Array.isArray(keys) || keys.length === 0 ? (
          <div className="empty-state"><div style={{ fontSize: 13 }}>No API keys yet. Create one to access the API.</div></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Key</th><th>Last used</th><th>Requests</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {keys.map((k: any) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k.key_prefix}...</code></td>
                  <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{k.last_used ? formatDate(k.last_used) : 'Never'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{k.request_count || 0}</td>
                  <td><span className={`badge ${k.is_active ? 'badge-paid' : 'badge-draft'}`}>{k.is_active ? 'Active' : 'Revoked'}</span></td>
                  <td>{k.is_active && <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('Revoke this API key? This cannot be undone.')) revokeMutation.mutate(k.id) }}><Trash2 size={12} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Create API key</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Key name *</label><input {...register('name', { required: true })} className="form-input" placeholder="e.g. Production App" /></div>
                <div className="form-group"><label className="form-label">Expiry date (optional)</label><input {...register('expires_at')} className="form-input" type="date" /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create key'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── WHITE LABEL TAB ──────────────────────────────────────
function WhiteLabelTab({ plan }: { plan: string }) {
  const qc = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['white-label'], queryFn: () => api.get<any>('/enterprise/white-label') })
  const { register, handleSubmit, reset } = useForm()

  useEffect(() => { if (settings) reset(settings) }, [settings, reset])

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put('/enterprise/white-label', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['white-label'] }); toast.success('White label settings saved!') },
    onError: (e: any) => toast.error(e.message)
  })

  if (plan !== 'enterprise') return (
    <div className="card card-p" style={{ textAlign: 'center', padding: 40 }}>
      <Globe size={32} style={{ margin: '0 auto 16px', color: 'var(--text-subtle)' }} />
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>White label requires Enterprise plan</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Use your own brand, logo, colours and custom domain</div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card card-p">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Brand identity</div>
          <div className="form-group"><label className="form-label">Brand name</label><input {...register('brand_name')} className="form-input" placeholder="Your Company" /></div>
          <div className="form-group"><label className="form-label">Logo URL</label><input {...register('brand_logo_url')} className="form-input" placeholder="https://yourcompany.com/logo.png" /></div>
          <div className="form-group"><label className="form-label">Primary colour</label><input {...register('brand_primary_color')} className="form-input" placeholder="#1a1814" /></div>
          <div className="form-group"><label className="form-label">Accent colour</label><input {...register('brand_accent_color')} className="form-input" placeholder="#22c55e" /></div>
        </div>
        <div className="card card-p">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Domain & email</div>
          <div className="form-group"><label className="form-label">Custom domain</label><input {...register('custom_domain')} className="form-input" placeholder="invoices.yourcompany.com" /></div>
          <div className="form-group"><label className="form-label">Email from address</label><input {...register('custom_email_from')} className="form-input" placeholder="billing@yourcompany.com" /></div>
          <div className="form-group"><label className="form-label">Email sender name</label><input {...register('custom_email_name')} className="form-input" placeholder="Your Company Billing" /></div>
          <div className="form-group"><label className="form-label">Invoice footer text</label><textarea {...register('invoice_footer')} className="form-input" rows={2} placeholder="Your Company Ltd · Company Reg No. 12345678 · VAT No. GB123456789" style={{ resize: 'vertical' }} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input {...register('hide_powered_by')} type="checkbox" style={{ width: 'auto', accentColor: 'var(--text)' }} />
            Hide "Powered by InvoicePro" branding
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save white label settings'}</button>
      </div>
    </form>
  )
}

// ── TAX REPORT TAB ───────────────────────────────────────
function TaxReportTab() {
  const now = new Date()
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`)
  const [to, setTo] = useState(now.toISOString().split('T')[0])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const generateReport = async () => {
    setLoading(true)
    try {
      const data = await api.get<any>(`/enterprise/tax-report?from=${from}&to=${to}`)
      setReport(data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = async (format: string) => {
    const headers = await (api as any).getHeaders?.() || {}
    const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/enterprise/export/${format}?from=${from}&to=${to}`, { headers })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `export-${format}-${from}.${format === 'csv' || format === 'xero' ? 'csv' : 'json'}`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Generate tax report</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 160 }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 160 }} />
          </div>
          {/* Quick ranges */}
          {[['This year', `${now.getFullYear()}-01-01`, now.toISOString().split('T')[0]],
            ['Q1', `${now.getFullYear()}-01-01`, `${now.getFullYear()}-03-31`],
            ['Q2', `${now.getFullYear()}-04-01`, `${now.getFullYear()}-06-30`],
            ['Q3', `${now.getFullYear()}-07-01`, `${now.getFullYear()}-09-30`],
            ['Q4', `${now.getFullYear()}-10-01`, `${now.getFullYear()}-12-31`],
          ].map(([label, f, t]) => (
            <button key={label as string} type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(f as string); setTo(t as string) }}>{label}</button>
          ))}
          <button className="btn btn-primary" onClick={generateReport} disabled={loading}>{loading ? 'Generating...' : 'Generate report'}</button>
        </div>
      </div>

      {report && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              ['Total revenue', formatCurrency(report.revenue.gross), 'var(--green)'],
              ['VAT collected', formatCurrency(report.vat.collected), 'var(--blue)'],
              ['VAT reclaimable', formatCurrency(report.vat.reclaimable), 'var(--amber)'],
              ['Net VAT payable', formatCurrency(report.vat.net_payable), report.vat.net_payable > 0 ? 'var(--red)' : 'var(--green)'],
            ].map(([label, value, color]: any) => (
              <div key={label} className="metric-card">
                <div className="metric-label">{label}</div>
                <div className="metric-value" style={{ fontSize: 20, color }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="card card-p" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Summary for {report.period.from} — {report.period.to}</div>
            {[
              ['Gross revenue', formatCurrency(report.revenue.gross)],
              ['VAT collected', `-${formatCurrency(report.vat.collected)}`],
              ['Net revenue', formatCurrency(report.revenue.net)],
              ['Total expenses', `-${formatCurrency(report.expenses.total)}`],
              ['VAT reclaimable', `+${formatCurrency(report.vat.reclaimable)}`],
              ['Net profit', formatCurrency(report.net_profit)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 15, fontWeight: 700 }}>
              <span>VAT payable to HMRC</span>
              <span style={{ color: report.vat.net_payable > 0 ? 'var(--red)' : 'var(--green)' }}>{formatCurrency(report.vat.net_payable)}</span>
            </div>
          </div>

          <div className="card card-p">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Export</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => exportCSV('csv')}><Download size={14} /> Download CSV</button>
              <button className="btn btn-secondary" onClick={() => exportCSV('xero')}><Download size={14} /> Xero format</button>
              <button className="btn btn-secondary" onClick={() => exportCSV('quickbooks')}><Download size={14} /> QuickBooks format</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
