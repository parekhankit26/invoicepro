import { useEffect, useState } from 'react'
import { useNavigate, NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Receipt, BarChart3, LogOut, Clock, FileCheck, ShieldAlert } from 'lucide-react'

const getTeamSession = () => {
  try {
    return {
      token: localStorage.getItem('team_token'),
      membership: JSON.parse(localStorage.getItem('team_membership') || 'null'),
      user: JSON.parse(localStorage.getItem('team_user') || 'null'),
    }
  } catch { return { token: null, membership: null, user: null } }
}

const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 200 200" fill="none">
    <rect width="200" height="200" rx="40" fill="#1a1814"/>
    <rect x="40" y="36" width="90" height="10" rx="5" fill="white"/>
    <rect x="40" y="58" width="68" height="10" rx="5" fill="white" opacity="0.5"/>
    <circle cx="148" cy="154" r="36" fill="#a3e635"/>
    <path d="M136 154 L144 162 L162 144" stroke="#1a1814" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
)

export default function TeamDashboard() {
  const navigate = useNavigate()
  const { token, membership, user } = getTeamSession()

  useEffect(() => {
    if (!token || !membership) navigate('/team/login')
  }, [])

  if (!token || !membership) return null

  const owner = membership.owner_profile || {}
  const perms = membership.permissions || {}
  const role = membership.role || 'staff'

  const logout = () => {
    localStorage.removeItem('team_token')
    localStorage.removeItem('team_membership')
    localStorage.removeItem('team_user')
    navigate('/team/login')
  }

  const roleColor: Record<string, string> = {
    admin: '#7c3aed', manager: '#1d4ed8', staff: '#756d5c',
    accountant: '#b45309', viewer: '#9ca3af'
  }

  const navItems = [
    { to: '/team/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
    { to: '/team/invoices', icon: FileText, label: 'Invoices', show: perms.create_invoices || perms.send_invoices || role === 'admin' || role === 'manager' },
    { to: '/team/quotes', icon: FileCheck, label: 'Quotes', show: perms.create_invoices || role === 'admin' || role === 'manager' },
    { to: '/team/clients', icon: Users, label: 'Clients', show: perms.manage_clients || role === 'admin' || role === 'manager' },
    { to: '/team/time', icon: Clock, label: 'Time tracking', show: true },
    { to: '/team/expenses', icon: Receipt, label: 'Expenses', show: perms.manage_expenses || role === 'admin' },
    { to: '/team/reports', icon: BarChart3, label: 'Reports', show: perms.view_reports || role === 'admin' || role === 'manager' || role === 'accountant' },
  ].filter(n => n.show)

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      {/* Sidebar */}
      <aside style={{ width:220, background:'white', borderRight:'1px solid #e8e5de', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:100 }}>
        <div style={{ padding:'16px', borderBottom:'1px solid #e8e5de' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <Logo/>
            <span style={{ fontWeight:700, fontSize:14, letterSpacing:'-0.02em' }}>InvoicePro</span>
          </div>
          <div style={{ background:'#f8f7f4', borderRadius:8, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color:'#b8b2a3', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Working for</div>
            <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {owner.company_name || owner.full_name || 'Your employer'}
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:9, padding:'8px 12px',
                borderRadius:7, margin:'1px 0', color: isActive ? 'white' : '#756d5c',
                background: isActive ? '#1a1814' : 'transparent', textDecoration:'none',
                fontSize:13.5, fontWeight:500, transition:'all .12s'
              })}>
              <Icon size={15}/>{label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div style={{ padding:'12px 10px', borderTop:'1px solid #e8e5de' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px' }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'#1a1814', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 }}>
              {(membership.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {membership.full_name || user?.email?.split('@')[0]}
              </div>
              <div style={{ fontSize:11, color: roleColor[role] || '#756d5c', fontWeight:600, textTransform:'capitalize' }}>{role}</div>
            </div>
            <button onClick={logout} style={{ background:'none', border:'none', cursor:'pointer', color:'#b8b2a3', display:'flex', padding:4 }} title="Sign out">
              <LogOut size={14}/>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft:220, flex:1, minHeight:'100vh', background:'#f8f7f4' }}>
        {/* Role/context banner */}
        <div style={{ background:'white', borderBottom:'1px solid #e8e5de', padding:'8px 32px', display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#756d5c', position:'sticky', top:0, zIndex:50 }}>
          <span style={{ background: roleColor[role] || '#756d5c', color:'white', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:600, textTransform:'capitalize' }}>{role}</span>
          <span>You are accessing <strong>{owner.company_name || owner.full_name || 'your employer'}</strong>'s account</span>
          {role === 'viewer' && (
            <span style={{ marginLeft:'auto', color:'#b45309', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
              <ShieldAlert size={12}/> View only — no changes permitted
            </span>
          )}
          {!perms.view_reports && role !== 'admin' && role !== 'manager' && role !== 'accountant' && (
            <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af' }}>Limited access</span>
          )}
        </div>
        <Outlet/>
      </main>
    </div>
  )
}
