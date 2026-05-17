import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Receipt, BarChart3, Settings, LogOut, Clock, FileCheck, Shield, TrendingUp, Zap, Heart, Gift, Palette, Menu, X } from 'lucide-react'
import { useAuthStore } from '../lib/authStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import AIAssistant from './AIAssistant'
import toast from 'react-hot-toast'

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 200 200" fill="none" style={{ flexShrink: 0 }}>
    <rect width="200" height="200" rx="40" fill="#1a1814"/>
    <rect x="40" y="36" width="90" height="10" rx="5" fill="white"/>
    <rect x="40" y="58" width="68" height="10" rx="5" fill="white" opacity="0.5"/>
    <rect x="40" y="80" width="76" height="10" rx="5" fill="white" opacity="0.5"/>
    <circle cx="148" cy="154" r="36" fill="#a3e635"/>
    <path d="M136 154 L144 162 L162 144" stroke="#1a1814" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
)

const nav = [
  { section: 'Menu', items: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/invoices', icon: FileText, label: 'Invoices' },
    { to: '/quotes', icon: FileCheck, label: 'Quotes' },
    { to: '/clients', icon: Users, label: 'Clients' },
    { to: '/time', icon: Clock, label: 'Time tracking' },
    { to: '/expenses', icon: Receipt, label: 'Expenses' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
  ]},
  { section: 'Analytics', items: [
    { to: '/insights', icon: TrendingUp, label: 'Insights' },
    { to: '/cashflow', icon: Zap, label: 'Cash flow' },
    { to: '/happiness', icon: Heart, label: 'Client happiness' },
    { to: '/year-review', icon: Gift, label: 'Year in review' },
  ]},
  { section: 'Tools', items: [
    { to: '/designer', icon: Palette, label: 'Invoice designer' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]},
]

const planColors: Record<string,string> = {
  free: '#888', starter: '#1d4ed8', pro: '#7c3aed', enterprise: '#b45309'
}

export default function Layout() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<any>('/auth/profile'),
    staleTime: 60_000
  })

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Close sidebar on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/auth')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U'

  const SidebarContent = () => (
    <>
      <div className="sidebar-logo">
        <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Logo/>
            <span style={{ fontWeight:700, fontSize:15, letterSpacing:'-0.03em' }}>InvoicePro</span>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ display:'none', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}
            className="sidebar-close-btn"
          >
            <X size={18}/>
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        {nav.map(section => (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={15}/>{label}
              </NavLink>
            ))}
          </div>
        ))}

        {/* Workspace / Enterprise admin — plan-aware */}
        <div style={{ marginTop: 4 }}>
          <div className="nav-section-label">Workspace</div>
          <NavLink
            to="/enterprise"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            style={({ isActive }) => ({
              ...(profile?.plan === 'enterprise' && !isActive ? {
                background: '#fffbeb',
                color: '#b45309',
              } : {}),
            })}
          >
            <Shield size={15}/>
            <span style={{ flex: 1 }}>
              {profile?.plan === 'enterprise' ? 'Admin panel' : 'Team & features'}
            </span>
            {profile?.plan === 'enterprise' && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                background: '#fef3c7', color: '#92400e',
                padding: '2px 6px', borderRadius: 10,
                border: '1px solid #fcd34d', flexShrink: 0,
              }}>ADMIN</span>
            )}
            {profile?.plan === 'pro' && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                background: '#ede9fe', color: '#6d28d9',
                padding: '2px 6px', borderRadius: 10,
                border: '1px solid #c4b5fd', flexShrink: 0,
              }}>PRO</span>
            )}
          </NavLink>
        </div>
      </nav>

      {/* User footer */}
      <div style={{ padding:'10px 8px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:'#1a1814', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {profile?.full_name || user?.email?.split('@')[0]}
            </div>
            <div style={{ fontSize:11, color:planColors[profile?.plan || 'free'], fontWeight:600, textTransform:'capitalize' }}>
              {profile?.plan || 'free'} plan
            </div>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost btn-icon" title="Sign out">
            <LogOut size={14}/>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="app-layout">
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button
          onClick={() => setSidebarOpen(true)}
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text)', padding:8, margin:-8, display:'flex', alignItems:'center' }}
          aria-label="Open menu"
        >
          <Menu size={22}/>
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Logo/>
          <span style={{ fontWeight:700, fontSize:14, letterSpacing:'-0.02em' }}>InvoicePro</span>
        </div>
        <div style={{ width:38 }}/>{/* spacer */}
      </div>

      {/* Mobile overlay */}
      <div
        className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <SidebarContent/>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Outlet/>
        <AIAssistant/>
      </main>
    </div>
  )
}
