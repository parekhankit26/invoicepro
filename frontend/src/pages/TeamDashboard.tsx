import { useEffect, useState } from 'react'
import { useNavigate, NavLink, Outlet, Routes, Route } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Receipt, BarChart3, LogOut, Zap, Clock, FileCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Dashboard from './Dashboard'
import InvoicesPage from './InvoicesPage'
import InvoiceDetail from './InvoiceDetail'
import ClientsPage from './ClientsPage'
import ClientDetail from './ClientDetail'
import ExpensesPage from './ExpensesPage'
import ReportsPage from './ReportsPage'
import QuotesPage from './QuotesPage'
import TimeTrackingPage from './TimeTrackingPage'

// Team member uses a special API that proxies to owner's data
const getTeamSession = () => {
  const token = localStorage.getItem('team_token')
  const membership = JSON.parse(localStorage.getItem('team_membership') || 'null')
  const user = JSON.parse(localStorage.getItem('team_user') || 'null')
  return { token, membership, user }
}

const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 200 200" fill="none">
    <rect width="200" height="200" rx="40" fill="#1a1814"/>
    <rect x="40" y="36" width="90" height="10" rx="5" fill="white"/>
    <rect x="40" y="58" width="68" height="10" rx="5" fill="white" opacity="0.5"/>
    <circle cx="148" cy="154" r="36" fill="#a3e635"/>
    <path d="M136 154 L144 162 L162 144" stroke="#1a1814" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>
)

export default function TeamDashboard() {
  const navigate = useNavigate()
  const { token, membership, user } = getTeamSession()

  useEffect(() => {
    if (!token || !membership) navigate('/team/login')
  }, [])

  if (!token || !membership) return null

  const owner = membership.owner_profile
  const perms = membership.permissions || {}
  const role = membership.role

  const logout = () => {
    localStorage.removeItem('team_token')
    localStorage.removeItem('team_membership')
    localStorage.removeItem('team_user')
    navigate('/team/login')
  }

  const roleColor: Record<string, string> = { admin: '#7c3aed', manager: '#1d4ed8', staff: '#756d5c', accountant: '#b45309', viewer: '#b8b2a3' }

  const navItems = [
    { to: '/team/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
    { to: '/team/invoices', icon: FileText, label: 'Invoices', show: perms.create_invoices || perms.send_invoices },
    { to: '/team/quotes', icon: FileCheck, label: 'Quotes', show: perms.create_invoices },
    { to: '/team/clients', icon: Users, label: 'Clients', show: perms.manage_clients },
    { to: '/team/time', icon: Clock, label: 'Time tracking', show: true },
    { to: '/team/expenses', icon: Receipt, label: 'Expenses', show: perms.manage_expenses },
    { to: '/team/reports', icon: BarChart3, label: 'Reports', show: perms.view_reports },
  ].filter(n => n.show)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: 'white', borderRight: '1px solid #e8e5de', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e8e5de' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Logo />
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>InvoicePro</span>
          </div>
          {/* Business owner info */}
          <div style={{ background: '#f8f7f4', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#b8b2a3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Working for</div>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner?.company_name || owner?.full_name || 'Your employer'}</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b8b2a3', padding: '6px 12px 4px' }}>Menu</div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 7, margin: '1px 0', color: isActive ? 'white' : '#756d5c', background: isActive ? '#1a1814' : 'transparent', textDecoration: 'none', fontSize: 13.5, fontWeight: 500, transition: 'all .12s' })}>
              <Icon size={15} />{label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px 10px', borderTop: '1px solid #e8e5de' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#1a1814', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              {(membership.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{membership.full_name || user?.email?.split('@')[0]}</div>
              <div style={{ fontSize: 11, color: roleColor[role] || '#756d5c', fontWeight: 600, textTransform: 'capitalize' }}>{role}</div>
            </div>
            <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b8b2a3', display: 'flex', padding: 4 }} title="Sign out"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh' }}>
        {/* Role banner */}
        <div style={{ background: '#f8f7f4', borderBottom: '1px solid #e8e5de', padding: '8px 32px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#756d5c' }}>
          <span style={{ background: roleColor[role] || '#756d5c', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{role}</span>
          <span>You are viewing <strong>{owner?.company_name || owner?.full_name}</strong>'s InvoicePro account</span>
          {!perms.create_invoices && <span style={{ marginLeft: 'auto', color: '#b45309', fontSize: 11 }}>⚠ View only</span>}
        </div>
        <Outlet />
      </main>
    </div>
  )
}

export function TeamDashboardHome() {
  return <Dashboard />
}
