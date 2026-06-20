import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Receipt, BarChart3, Settings, LogOut, Clock, FileCheck, Crown, TrendingUp, Zap, Heart, Gift, Palette, Menu, X, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../lib/authStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import AIAssistant from './AIAssistant'
import toast from 'react-hot-toast'

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 200 200" fill="none">
    <rect width="200" height="200" rx="40" fill="#1a1814"/>
    <rect x="40" y="36" width="90" height="10" rx="5" fill="white"/>
    <rect x="40" y="58" width="68" height="10" rx="5" fill="white" opacity="0.5"/>
    <rect x="40" y="80" width="76" height="10" rx="5" fill="white" opacity="0.5"/>
    <rect x="40" y="124" width="90" height="1.5" rx="0.75" fill="white" opacity="0.2"/>
    <rect x="40" y="138" width="38" height="10" rx="5" fill="white" opacity="0.3"/>
    <rect x="92" y="138" width="38" height="10" rx="5" fill="#a3e635"/>
    <circle cx="148" cy="154" r="36" fill="#a3e635"/>
    <path d="M136 154 L144 162 L162 144" stroke="#1a1814" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
)

const allNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/quotes', icon: FileCheck, label: 'Quotes' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/time', icon: Clock, label: 'Time' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/insights', icon: TrendingUp, label: 'Insights' },
  { to: '/cashflow', icon: Zap, label: 'Cash flow' },
  { to: '/happiness', icon: Heart, label: 'Happiness' },
  { to: '/year-review', icon: Gift, label: 'Year review' },
  { to: '/designer', icon: Palette, label: 'Designer' },
  { to: '/enterprise', icon: Crown, label: 'Enterprise' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

// Bottom 4 tabs shown on mobile
const bottomTabs = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
]

const sidebarNav = [
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
    { to: '/enterprise', icon: Crown, label: 'Enterprise' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]},
]

const planColors: Record<string,string> = { free:'#888', starter:'#1d4ed8', pro:'#7c3aed', enterprise:'#b45309' }

export default function Layout() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile'), staleTime: 60_000 })
  const handleSignOut = async () => { await signOut(); toast.success('Signed out'); navigate('/auth') }
  const initials = profile?.full_name ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() : user?.email?.[0].toUpperCase() || 'U'

  // Lock body scroll so ONLY main-content scrolls — applies on every page
  useEffect(() => {
    const isPhone = !!(window as any).Capacitor || window.innerWidth <= 900
    if (isPhone) {
      document.documentElement.style.overflow = 'hidden'
      document.documentElement.style.height = '100%'
      document.body.style.overflow = 'hidden'
      document.body.style.height = '100%'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    }
    return () => {
      document.documentElement.style.overflow = ''
      document.documentElement.style.height = ''
      document.body.style.overflow = ''
      document.body.style.height = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [])

  // Reset middle scroll to top on every page navigation
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [location.pathname])

  const isMobile = typeof window !== 'undefined' && (
    !!(window as any).Capacitor || window.innerWidth <= 900
  )

  return (
    <div className="app-layout" style={isMobile ? {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg)'
    } : undefined}>
      {/* ── Desktop sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Logo />
            <span style={{ fontWeight:700, fontSize:15, letterSpacing:'-0.03em' }}>InvoicePro</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {sidebarNav.map(section => (
            <div key={section.section}>
              <div className="nav-section-label">{section.section}</div>
              {section.items.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={15} />{label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ padding:'12px 10px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'#1a1814', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 }}>{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.full_name || user?.email?.split('@')[0]}</div>
              <div style={{ fontSize:11, color:planColors[profile?.plan || 'free'], fontWeight:600, textTransform:'capitalize' }}>{profile?.plan || 'free'} plan</div>
            </div>
            <button onClick={handleSignOut} className="btn btn-ghost btn-icon" title="Sign out"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="mobile-topbar" style={isMobile ? {
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)'
      } : undefined}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Logo />
          <span style={{ fontWeight:700, fontSize:16, letterSpacing:'-0.03em' }}>InvoicePro</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setDrawerOpen(true)}>
          <Menu size={22} />
        </button>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer-panel" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'#1a1814', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>{initials}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{profile?.full_name || user?.email?.split('@')[0]}</div>
                  <div style={{ fontSize:11, color:planColors[profile?.plan || 'free'], fontWeight:600, textTransform:'capitalize' }}>{profile?.plan || 'free'} plan</div>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ background:'none', border:'none', padding:6, cursor:'pointer', color:'var(--text-muted)', borderRadius:8 }}>
                <X size={20} />
              </button>
            </div>
            <nav style={{ flex:1, overflowY:'auto', padding:'8px 12px' }}>
              {allNav.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to} to={to}
                  className={({ isActive }) => `drawer-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  <ChevronRight size={14} style={{ marginLeft:'auto', opacity:0.3 }} />
                </NavLink>
              ))}
            </nav>
            <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
              <button onClick={handleSignOut} className="drawer-signout-btn">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main ref={mainRef} className="main-content" style={isMobile ? {
        flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        background: 'var(--bg)'
      } : undefined}>
        <Outlet />
        <AIAssistant />
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="mobile-tabbar" style={isMobile ? {
        flexShrink: 0, display: 'flex', minHeight: 56,
        background: 'var(--surface)', borderTop: '1px solid var(--border)'
      } : undefined}>
        {bottomTabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button className="tab-item" onClick={() => setDrawerOpen(true)}>
          <Menu size={22} />
          <span>More</span>
        </button>
      </nav>
    </div>
  )
}
