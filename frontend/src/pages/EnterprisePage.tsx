import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Key, Users, Globe, FileText, Download, Plus, Trash2, Copy, X, Shield, CheckCircle, Clock, ArrowRight, Sparkles, Zap } from 'lucide-react'
import { api, API_BASE } from '../lib/api'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'
import { modalState } from '../lib/modalState'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'team', label: 'Team members', icon: Users },
  { id: 'apikeys', label: 'API keys', icon: Key },
  { id: 'whitelabel', label: 'White label', icon: Globe },
  { id: 'tax', label: 'Tax reports', icon: FileText },
  { id: 'financing', label: 'Financing', icon: Zap },
]

const planMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:       { label: 'Free',       color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  starter:    { label: 'Starter',    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  pro:        { label: 'Pro',        color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd' },
  enterprise: { label: 'Enterprise', color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
}

export default function EnterprisePage() {
  const [tab, setTab] = useState('overview')
  const { data: profile, refetch: refetchProfile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })
  const plan = profile?.plan || 'free'

  // Show success toast when returning from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgrade') === 'success') {
      const upgradedPlan = params.get('plan') || 'new'
      toast.success(`🎉 Welcome to ${upgradedPlan.charAt(0).toUpperCase() + upgradedPlan.slice(1)}! Your plan is now active.`)
      refetchProfile()
      window.history.replaceState({}, '', '/enterprise')
    } else if (params.get('upgrade') === 'cancelled') {
      toast('Upgrade cancelled — you can try again anytime', { icon: 'ℹ️' })
      window.history.replaceState({}, '', '/enterprise')
    }
  }, [])
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
        {tab === 'financing'  && <FinancingAdminTab />}
      </div>
    </>
  )
}

// ── UPGRADE MODAL ────────────────────────────────────────
const PLANS = [
  {
    id: 'starter', label: 'Starter', price: 9, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
    features: ['Unlimited invoices & quotes', 'Client portal links', 'WhatsApp notifications', 'PDF generation', 'Email support'],
  },
  {
    id: 'pro', label: 'Pro', price: 19, color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd',
    features: ['Everything in Starter', 'Team members (up to 10)', 'Role-based access', 'Advanced reports', 'Priority support'],
    popular: true,
  },
  {
    id: 'enterprise', label: 'Enterprise', price: 49, color: '#92400e', bg: '#fef3c7', border: '#fcd34d',
    features: ['Everything in Pro', 'Unlimited team members', 'White label branding', 'API access', 'Custom domain', 'Tax report export', 'Dedicated support'],
  },
]

const COUNTRY_CURRENCY: Record<string, string> = {
  IN:'INR',PK:'INR',BD:'INR',LK:'INR',NP:'INR',
  US:'USD',CA:'USD',MX:'USD',AU:'USD',NZ:'USD',SG:'USD',HK:'USD',
  AE:'USD',SA:'USD',QA:'USD',KW:'USD',BH:'USD',OM:'USD',
  GB:'GBP',IE:'GBP',
  DE:'EUR',FR:'EUR',IT:'EUR',ES:'EUR',NL:'EUR',BE:'EUR',
  PT:'EUR',AT:'EUR',FI:'EUR',GR:'EUR',SE:'EUR',NO:'EUR',
  DK:'EUR',PL:'EUR',CZ:'EUR',RO:'EUR',HU:'EUR',CH:'EUR',
}

async function detectCurrency(): Promise<string> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    return COUNTRY_CURRENCY[data.country_code] || 'GBP'
  } catch {
    return 'GBP'
  }
}

function UpgradeModal({ currentPlan, subInfo: defaultSubInfo, onClose }: { currentPlan: string; subInfo: any; onClose: () => void }) {
  const [selected, setSelected] = useState(currentPlan === 'free' ? 'pro' : currentPlan === 'starter' ? 'pro' : 'enterprise')
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [currency, setCurrency] = useState('GBP')
  const [subInfo, setSubInfo] = useState(defaultSubInfo)

  useEffect(() => {
    detectCurrency().then(cur => {
      if (cur === 'GBP') return // GBP is already loaded
      setCurrency(cur)
      api.get<any>(`/billing/subscription?currency=${cur}`)
        .then(data => setSubInfo(data))
        .catch(() => {}) // fall back to default subInfo
    })
  }, [])

  const planInfo = subInfo?.available_plans?.[selected]
  const currencySymbol = subInfo?.currency_symbol || planInfo?.currency_symbol || '£'
  const stripeConfigured = billing === 'yearly'
    ? planInfo?.yearly_configured
    : planInfo?.monthly_configured
  const stripeReady = stripeConfigured ?? planInfo?.configured

  const selectedPlan = PLANS.find(p => p.id === selected)
  const monthlyPrice = planInfo?.price_monthly ?? selectedPlan?.price
  const yearlyPrice = planInfo?.price_yearly
  const yearlyPerMonth = yearlyPrice ? Math.round((yearlyPrice / 12) * 100) / 100 : null
  const yearlySaving = planInfo?.yearly_saving ?? 0

  const displayPrice = billing === 'yearly' && yearlyPerMonth ? yearlyPerMonth : monthlyPrice

  const handleStripeCheckout = async () => {
    setLoading(true)
    try {
      const data = await api.post<any>('/billing/subscribe', { plan: selected, billing_period: billing, currency })
      window.location.href = data.url
    } catch (e: any) {
      toast.error(e.message)
      setLoading(false)
    }
  }

  const handleEmailRequest = () => {
    const plan = PLANS.find(p => p.id === selected)
    const subject = encodeURIComponent(`Upgrade request — ${plan?.label} plan`)
    const body = encodeURIComponent(`Hi,\n\nI'd like to upgrade my InvoicePro account to the ${plan?.label} plan (${billing}).\n\nPlease let me know how to proceed.\n\nThank you!`)
    window.open(`mailto:support@invoicepro.com?subject=${subject}&body=${body}`, '_blank')
    setEmailSent(true)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Upgrade your plan</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {stripeReady ? 'Instant activation — pay securely with Stripe' : 'Choose a plan and we\'ll get you set up'}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18}/></button>
        </div>

        <div className="modal-body">
          {/* Monthly / Yearly toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ display: 'inline-flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 3 }}>
              <button
                onClick={() => setBilling('monthly')}
                style={{ padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s',
                  background: billing === 'monthly' ? 'var(--surface)' : 'transparent',
                  color: billing === 'monthly' ? 'var(--text)' : 'var(--text-muted)',
                  boxShadow: billing === 'monthly' ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                }}>Monthly</button>
              <button
                onClick={() => setBilling('yearly')}
                style={{ padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
                  background: billing === 'yearly' ? 'var(--surface)' : 'transparent',
                  color: billing === 'yearly' ? 'var(--text)' : 'var(--text-muted)',
                  boxShadow: billing === 'yearly' ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                }}>
                Yearly
                {yearlySaving > 0 && (
                  <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>
                    SAVE {yearlySaving}%
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {PLANS.map(plan => {
              const isSelected = selected === plan.id
              const isCurrent = currentPlan === plan.id
              const isDowngrade = ['free','starter','pro','enterprise'].indexOf(plan.id) < ['free','starter','pro','enterprise'].indexOf(currentPlan)
              const pInfo = subInfo?.available_plans?.[plan.id]
              const pMonthly = pInfo?.price_monthly ?? plan.price
              const pYearly = pInfo?.price_yearly
              const pYearlyPerMonth = pYearly ? Math.round((pYearly / 12) * 100) / 100 : null
              const showPrice = billing === 'yearly' && pYearlyPerMonth ? pYearlyPerMonth : pMonthly
              const sym = pInfo?.currency_symbol || currencySymbol
              return (
                <div key={plan.id}
                  onClick={() => !isCurrent && !isDowngrade && setSelected(plan.id)}
                  style={{
                    border: `2px solid ${isSelected ? plan.color : 'var(--border)'}`,
                    borderRadius: 12, padding: '16px 14px',
                    cursor: isCurrent || isDowngrade ? 'default' : 'pointer',
                    background: isSelected ? plan.bg : 'var(--surface)',
                    transition: 'all .15s', position: 'relative',
                    opacity: isCurrent || isDowngrade ? 0.45 : 1,
                  }}>
                  {plan.popular && !isCurrent && !isDowngrade && (
                    <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                      MOST POPULAR
                    </div>
                  )}
                  {isCurrent && (
                    <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#6b7280', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      CURRENT
                    </div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 15, color: plan.color, marginBottom: 4 }}>{plan.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 2 }}>
                    {sym}{showPrice}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
                  </div>
                  {billing === 'yearly' && pYearly && (
                    <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600, marginBottom: 10 }}>
                      {sym}{pYearly}/year · save {pInfo?.yearly_saving ?? 0}%
                    </div>
                  )}
                  {billing === 'monthly' && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>billed monthly</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
                        <CheckCircle size={12} color={plan.color} style={{ flexShrink: 0, marginTop: 1 }}/>
                        <span style={{ color: 'var(--text-muted)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {isSelected && !isCurrent && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${plan.border}`, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: plan.color, fontWeight: 600 }}>
                      <CheckCircle size={12}/> Selected
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Status / info bar */}
          {emailSent ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} color="#16a34a"/>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#15803d' }}>Upgrade request sent!</div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>We'll confirm and activate your plan within 24 hours.</div>
              </div>
            </div>
          ) : stripeReady ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={14} color="#16a34a"/>
              Secure payment via Stripe — your plan activates instantly after payment
            </div>
          ) : (
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
              <Zap size={13} style={{ marginRight: 6, verticalAlign: 'middle', color: '#b45309' }}/>
              {billing === 'yearly' ? 'Yearly price ID not set in admin panel yet — switching to email request' : 'Stripe not yet configured — clicking below sends an email upgrade request instead'}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {stripeReady ? (
            <button className="btn btn-primary" onClick={handleStripeCheckout} disabled={loading || currentPlan === selected}>
              {loading ? 'Redirecting to Stripe...' : `Subscribe — ${currencySymbol}${billing === 'yearly' && yearlyPrice ? yearlyPrice + '/yr' : displayPrice + '/mo'}`}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleEmailRequest} disabled={emailSent || currentPlan === selected}>
              {emailSent ? 'Request sent ✓' : `Request ${selectedPlan?.label} plan`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── OVERVIEW TAB ─────────────────────────────────────────
function OverviewTab({ plan, profile, onGoTab }: { plan: string; profile: any; onGoTab: (t: string) => void }) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const isEnterprise = plan === 'enterprise'
  const isPro = plan === 'pro' || isEnterprise

  const { data: subInfo } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<any>('/billing/subscription'),
  })

  const hasActiveSubscription = subInfo?.stripe_subscription_id && subInfo?.subscription_status === 'active'

  const handleBillingPortal = async () => {
    setPortalLoading(true)
    try {
      const data = await api.post<any>('/billing/portal', {})
      window.location.href = data.url
    } catch (e: any) {
      toast.error(e.message)
      setPortalLoading(false)
    }
  }

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isPro && (
            <button className="btn btn-sm" onClick={() => onGoTab('team')}
              style={{ background: isEnterprise ? 'rgba(255,255,255,0.12)' : 'var(--bg)', color: isEnterprise ? 'white' : 'var(--text)', border: isEnterprise ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)' }}>
              <Users size={13} /> Manage team
            </button>
          )}
          {hasActiveSubscription ? (
            <button className="btn btn-sm" onClick={handleBillingPortal} disabled={portalLoading}
              style={{ background: isEnterprise ? 'rgba(255,255,255,0.12)' : 'var(--bg)', color: isEnterprise ? 'white' : 'var(--text)', border: isEnterprise ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)' }}>
              <Key size={13} /> {portalLoading ? 'Opening...' : 'Manage billing'}
            </button>
          ) : plan !== 'free' ? null : (
            <button className="btn btn-sm btn-primary" onClick={() => { setShowUpgrade(true); modalState.open() }}>
              <Zap size={13} /> Upgrade
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
            <button className="btn btn-sm btn-primary" onClick={() => { setShowUpgrade(true); modalState.open() }}>
              <Zap size={13}/> Upgrade plan
            </button>
          </div>
        )}
      </div>

      {showUpgrade && <UpgradeModal currentPlan={plan} subInfo={subInfo} onClose={() => { setShowUpgrade(false); modalState.close() }} />}
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
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token || localStorage.getItem('team_token')
    const res = await fetch(`${API_BASE}/enterprise/export/${format}?from=${from}&to=${to}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
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

// ── FINANCING TAB ─────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:      { bg: '#fef9c3', color: '#b45309' },
  under_review: { bg: '#dbeafe', color: '#0369a1' },
  approved:     { bg: '#dcfce7', color: '#15803d' },
  funded:       { bg: '#dcfce7', color: '#15803d' },
  repaid:       { bg: '#f3f4f6', color: '#374151' },
  rejected:     { bg: '#fee2e2', color: '#dc2626' },
}

function FinancingAdminTab() {
  const { data: applications = [], isLoading, refetch } = useQuery({
    queryKey: ['financing-applications'],
    queryFn: () => api.get<any[]>('/features/financing/applications'),
  })

  const currencySymbol = (c: string) => ({ GBP: '£', USD: '$', EUR: '€', INR: '₹', CAD: 'C$', AUD: 'A$' }[c] || c + ' ')
  const fmtAmt = (amount: number, currency: string) =>
    `${currencySymbol(currency)}${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const apps = Array.isArray(applications) ? applications : []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Invoice financing applications</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Track the status of your financing requests</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>Refresh</button>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>Loading applications...</div>
      ) : apps.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
          <Zap size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
          <div style={{ marginBottom: 8 }}>No financing applications yet</div>
          <div style={{ fontSize: 12 }}>Apply for financing from any unpaid invoice over £500</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Invoice</th>
                <th>Net advance</th>
                <th>Applied</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app: any) => {
                const sc = STATUS_COLORS[app.status] || STATUS_COLORS.pending
                return (
                  <tr key={app.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{app.reference}</td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{app.invoices?.invoice_number || '—'}</div>
                      {app.invoices?.due_date && (
                        <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                          Due {new Date(app.invoices.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--green)' }}>{fmtAmt(app.net_advance, app.currency)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{app.fee_percent}% fee · {fmtAmt(app.gross_advance, app.currency)} gross</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(app.applied_at || app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>
                      {app.status === 'rejected' && app.rejection_reason
                        ? <span style={{ color: 'var(--red)' }}>{app.rejection_reason}</span>
                        : app.admin_notes || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>How it works:</strong> Apply for financing from any eligible invoice (£500+) to receive up to 90% of the invoice value within 24 hours.
        Our team reviews applications and updates the status here. You'll also receive email updates for each status change.
      </div>
    </div>
  )
}
