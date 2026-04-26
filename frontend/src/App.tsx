import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './lib/authStore'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import InvoicesPage from './pages/InvoicesPage'
import InvoiceDetail from './pages/InvoiceDetail'
import ClientsPage from './pages/ClientsPage'
import ClientDetail from './pages/ClientDetail'
import ExpensesPage from './pages/ExpensesPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import QuotesPage from './pages/QuotesPage'
import TimeTrackingPage from './pages/TimeTrackingPage'
import EnterprisePage from './pages/EnterprisePage'
import ClientPortalPage from './pages/ClientPortalPage'
import InsightsPage from './pages/InsightsPage'
import InvoiceDesignerPage from './pages/InvoiceDesignerPage'
import SatisfactionPage from './pages/SatisfactionPage'
import TeamAcceptPage from './pages/TeamAcceptPage'
import TeamLoginPage from './pages/TeamLoginPage'
import TeamDashboard from './pages/TeamDashboard'
import { CashFlowPage, HappinessPage, YearReviewPage } from './components/FeatureComponents'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12 }}>
      <svg width="40" height="40" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="40" fill="#1a1814"/><rect x="40" y="36" width="90" height="10" rx="5" fill="white"/><rect x="40" y="58" width="68" height="10" rx="5" fill="white" opacity="0.5"/><circle cx="148" cy="154" r="36" fill="#a3e635"/><path d="M136 154 L144 162 L162 144" stroke="#1a1814" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      <div style={{ color:'#756d5c', fontSize:13 }}>Loading InvoicePro...</div>
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export default function App() {
  const { setUser } = useAuthStore()
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { setUser(session?.user ?? null) })
    return () => subscription.unsubscribe()
  }, [setUser])

  return (
    <Routes>
      {/* ── PUBLIC ── */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/portal/:token" element={<ClientPortalPage />} />
      <Route path="/satisfaction/:token" element={<SatisfactionPage />} />

      {/* ── TEAM MEMBER ROUTES ── */}
      <Route path="/team/accept/:token" element={<TeamAcceptPage />} />
      <Route path="/team/login" element={<TeamLoginPage />} />
      <Route path="/team" element={<TeamDashboard />}>
        <Route index element={<Navigate to="/team/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="time" element={<TimeTrackingPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      {/* ── BUSINESS OWNER APP ── */}
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="time" element={<TimeTrackingPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="cashflow" element={<CashFlowPage />} />
        <Route path="happiness" element={<HappinessPage />} />
        <Route path="year-review" element={<YearReviewPage />} />
        <Route path="designer" element={<InvoiceDesignerPage />} />
        <Route path="enterprise" element={<EnterprisePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
