import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Receipt, BarChart3, Settings, LogOut, Clock, FileCheck, Crown, TrendingUp, Zap, Heart, Gift, Palette } from 'lucide-react'
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
    <path d="M136 154 L144 162 L162 144" stroke="#1a1814" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
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
    { to: '/enterprise', icon: Crown, label: 'Enterprise' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]},
]

const planColors: Record<string,string> = { free:'#888', starter:'#1d4ed8', pro:'#7c3aed', enterprise:'#b45309' }

export default function Layout() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile'), staleTime: 60_000 })
  const handleSignOut = async () => { await signOut(); toast.success('Signed out'); navigate('/auth') }
  const initials = profile?.full_name ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() : user?.email?.[0].toUpperCase() || 'U'

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Logo />
            <span style={{ fontWeight:700, fontSize:15, letterSpacing:'-0.03em' }}>InvoicePro</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav.map(section => (
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
      <main className="main-content">
        <Outlet />
        <AIAssistant />
      </main>
    </div>
  )
}
