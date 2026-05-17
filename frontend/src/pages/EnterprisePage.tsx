import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Key, Users, Globe, FileText, Download, Plus, Trash2, Copy, X, Shield, CheckCircle, Clock, ArrowRight, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'
import { modalState } from '../lib/modalState'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'team', label: 'Team members', icon: Users },
  { id: 'apikeys', label: 'API keys', icon: Key },
  { id: 'whitelabel', label: 'White label', icon: Globe },
  { id: 'tax', label: 'Tax reports', icon: FileText },
]

const planMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:       { label: 'Free',       color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  starter:    { label: 'Starter',    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  pro:        { label: 'Pro',        color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd' },
  enterprise: { label: 'Enterprise', color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
}

export default function EnterprisePage() {
  const [tab, setTab] = useState('overview')
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })
  const plan = profile?.plan || 'free'
  const pm = planMeta[plan] || planMeta.free
  const isEnterprise = plan === 'enterprise'
  const isPro = plan === 'pro' || isEnterprise

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEnterprise ? 'Workspace admin' : 'Team & features'}</h1>
          <p className="page-subtitle">
            {isEnterprise
              ? 'Manage your team, API access, white label branding and tax reports'
              : 'Invite team members, manage integrations and unlock advanced features'}
          </p>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: pm.bg, color: pm.color,
          border: `1px solid ${pm.border}`,
          padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.04em'
        }}>
          {isEnterprise && <Shield size={12} />}
          {pm.label.toUpperCase()} PLAN
        </span>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--text)' : '2px solid transparent',
                marginBottom: -1, fontFamily: 'inherit', transition: 'color .15s',
              }}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {tab === 'overview'   && <OverviewTab plan={plan} profile={profile} onGoTab={setTab} />}
        {tab === 'team'       && <TeamTab plan={plan} />}
        {tab === 'apikeys'    && <ApiKeysTab plan={plan} />}
        {tab === 'whitelabel' && <WhiteLabelTab plan={plan} />}
        {tab === 'tax'        && <TaxReportTab />}
      </div>
    </>
  )
}

// ── OVERVIEW TAB ─────────────────────────────────────────
function OverviewTab({ plan, profile, onGoTab }: { plan: string; profile: any; onGoTab: (t: string) => void }) {
  const isEnterprise = plan === 'enterprise'
  const isPro = plan === 'pro' || isEnterprise

  const { data: members = [] } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<any[]>('/team'),
    enabled: isPro,
  })
  const { data: keys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<any[]>('/enterprise/api-keys'),
    enabled: isEnterprise,
  })
  const { data: whiteLabel } = useQuery({
    queryKey: ['white-label'],
    queryFn: () => api.get<any>('/enterprise/white-label'),
    enabled: isEnterprise,
  })

  const memberList = Array.isArray(members) ? members : []
  const keyList = Array.isArray(keys) ? keys : []
  const activeMembers = memberList.filter((m: any) => m.status === 'active').length
  const pendingMembers = memberList.filter((m: any) => m.status === 'pending').length
  const activeKeys = keyList.filter((k: any) => k.is_active).length
  const whiteLabelConfigured = !!(whiteLabel?.brand_name || whiteLabel?.custom_domain)

  return (
    <div>
      {/* Workspace identity card */}
      <div style={{
        background: isEnterprise ? 'linear-gradient(135deg, #1a1814 0%, #2d2a25 100%)' : 'var(--surface)',
        border: isEnterprise ? 'none' : '1px solid var(--border)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: isEnterprise ? 'white' : 'var(--text)', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            background: isEnterprise ? '#a3e635' : 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {whiteLabel?.brand_logo_url
              ? <img src={whiteLabel.brand_logo_url} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6 }} />
              : <Shield size={24} color={isEnterprise ? '#1a1814' : 'var(--text-muted)'} />
            }
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
              {whiteLabel?.brand_name || profile?.company_name || profile?.full_name || 'Your workspace'}
            </div>
            <div style={{ fontSize: 13, opacity: isEnterprise ? 0.6 : 1, color: isEnterprise ? 'white' : 'var(--text-muted)', marginTop: 2 }}>
              {isEnterprise ? 'Enterprise workspace' : `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan workspace`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isPro && (
            <button className="btn btn-sm" onClick={() => onGoTab('team')}
              style={{ background: isEnterprise ? 'rgba(255,255,255,0.12)' : 'var(--bg)', color: isEnterprise ? 'white' : 'var(--text)', border: isEnterprise ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)' }}>
              <Users size={13} /> Manage team
            </button>
          )}
          {isEnterprise && (
            <button className="btn btn-sm" onClick={() => onGoTab('whitelabel')}
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Globe size={13} /> White label
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {isPro && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            {
              label: 'Active members',
              value: activeMembers,
              icon: CheckCircle, iconColor: '#16a34a',
              action: () => onGoTab('team'),
            },
            {
              label: 'Pending invites',
              value: pendingMembers,
              icon: Clock, iconColor: pendingMembers > 0 ? '#b45309' : '#9ca3af',
              action: pendingMembers > 0 ? () => onGoTab('team') : undefined,
            },
            ...(isEnterprise ? [
              {
                label: 'API keys active',
                value: activeKeys,
                icon: Key, iconColor: '#1d4ed8',
                action: () => onGoTab('apikeys'),
              },
              {
                label: 'White label',
                value: whiteLabelConfigured ? 'Configured' : 'Not set up',
                icon: Globe, iconColor: whiteLabelConfigured ? '#16a34a' : '#9ca3af',
                action: () => onGoTab('whitelabel'),
              },
            ] : []),
          ].map(({ label, value, icon: Icon, iconColor, action }) => (
            <div key={label}
              onClick={action}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 18px',
                cursor: action ? 'pointer' : 'default',
                transition: 'box-shadow .15s, transform .1s',
              }}
              onMouseEnter={e => { if (action) { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)' }}>{label}</div>
                <Icon size={14} color={iconColor} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{value}</div>
              {action && <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>View <ArrowRight size={10} /></div>}
            </div>
          ))}
        </div>
      )}

      {/* Team members quick view */}
      {isPro && memberList.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Team</div>
            <button className="btn btn-sm btn-ghost" onClick={() => onGoTab('team')} style={{ fontSize: 12 }}>
              Manage <ArrowRight size={11} />
            </button>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>
                {memberList.slice(0, 5).map((m: any) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.full_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{m.email}</div>
                    </td>
                    <td><span className="badge badge-sent">{m.role}</span></td>
                    <td><span className={`badge ${m.status === 'active' ? 'badge-paid' : 'badge-pending'}`}>{m.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{m.joined_at ? formatDate(m.joined_at) : 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {memberList.length > 5 && (
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              +{memberList.length - 5} more — <button className="btn btn-ghost btn-sm" onClick={() => onGoTab('team')} style={{ fontSize: 12 }}>view all</button>
            </div>
          )}
        </div>
      )}

      {/* Feature availability grid */}
      <div className="card card-p">
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Features on your plan</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {[
            { label: 'Unlimited invoices & quotes', included: true },
            { label: 'Client portal links', included: true },
            { label: 'WhatsApp notifications', included: true },
            { label: 'PDF generation', included: true },
            { label: 'Team members', included: isPro },
            { label: 'Advanced reports', included: isPro },
            { label: 'API access', included: plan === 'enterprise' },
            { label: 'White label branding', included: plan === 'enterprise' },
            { label: 'Custom domain', included: plan === 'enterprise' },
            { label: 'Tax report export', included: plan === 'enterprise' },
          ].map(({ label, included }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: included ? 'var(--text)' : 'var(--text-subtle)' }}>
              {included
                ? <CheckCircle size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--border)', flexShrink: 0 }} />
              }
              {label}
            </div>
          ))}
        </div>
        {plan !== 'enterprise' && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <Sparkles size={13} style={{ marginRight: 4, verticalAlign: 'middle', color: '#b45309' }} />
              Upgrade to Enterprise to unlock all features
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => toast('Contact us to upgrade your plan')}>
              Upgrade plan
            </button>
          </div>
        )}
      </div>
    </div>
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
      reset(); { setShowInvite(false); modalState.close() }
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
        <button className="btn btn-primary btn-sm" onClick={() => { setShowInvite(true); modalState.open() }}><Plus size={13} /> Invite member</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? <div className="empty-state">Loading...</div> :
        !Array.isArray(members) || members.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontWeight: 500, marginBottom: 4 }}>No team members yet</div>
            <div style={{ fontSize: 13 }}>Invite your team to collaborate</div>
          </div>
        ) : (
          <div className="table-wrapper"><table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.full_name || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.email}</td>
                  <td><span className="badge badge-sent">{m.role}</span></td>
                  <td><span className={`badge ${m.status === 'active' ? 'badge-paid' : m.status === 'pending' ? 'badge-pending' : 'badge-draft'}`}>{m.status}</span></td>
                  <td style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{m.joined_at ? formatDate(m.joined_at) : 'Pending'}</td>
                  <td style={{ display:'flex', gap:4 }}>
                      {m.status === 'pending' && (
                        <button className="btn btn-sm btn-secondary" title="Copy invite link" onClick={() => {
                          const url = `${window.location.origin}/team/accept/${m.invite_token}`
                          navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!')).catch(() => toast.error('Copy failed'))
                        }}>Link</button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('Remove this team member?')) removeMutation.mutate(m.id) }}><Trash2 size={12} /></button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowInvite(false), modalState.close())}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Invite team member</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowInvite(false); modalState.close() }}><X size={18} /></button>
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
                <button type="button" className="btn btn-secondary" onClick={() => { setShowInvite(false); modalState.close() }}>Cancel</button>
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
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ['api-keys'] }); setNewKey(data.api_key); reset(); { setShowCreate(false); modalState.close() } },
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
        <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(true); modalState.open() }}><Plus size={13} /> Create API key</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? <div className="empty-state">Loading...</div> :
        !Array.isArray(keys) || keys.length === 0 ? (
          <div className="empty-state"><div style={{ fontSize: 13 }}>No API keys yet. Create one to access the API.</div></div>
        ) : (
          <div className="table-wrapper"><table className="data-table">
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
          </table></div>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowCreate(false), modalState.close())}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Create API key</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowCreate(false); modalState.close() }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Key name *</label><input {...(register as any)('name', { required: true })} className="form-input" placeholder="e.g. Production App" /></div>
                <div className="form-group"><label className="form-label">Expiry date (optional)</label><input {...(register as any)('expires_at')} className="form-input" type="date" /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowCreate(false); modalState.close() }}>Cancel</button>
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
    const res = await fetch(`${(import.meta as any).env.VITE_API_URL || '/api'}/enterprise/export/${format}?from=${from}&to=${to}`, { headers })
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
