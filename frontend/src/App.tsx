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
import { CashFlowPage, HappinessPage, YearReviewPage } from './components/FeatureComponents'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12,background:'#1a1814',position:'fixed',inset:0 }}>
      <svg width="40" height="40" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="40" fill="#1a1814"/><rect x="40" y="36" width="90" height="10" rx="5" fill="white"/><rect x="40" y="58" width="68" height="10" rx="5" fill="white" opacity="0.5"/><circle cx="148" cy="154" r="36" fill="#a3e635"/><path d="M136 154 L144 162 L162 144" stroke="#1a1814" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
      <div style={{ color:'#756d5c',fontSize:13 }}>Loading InvoicePro...</div>
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

const API_URL = import.meta.env.VITE_API_URL || '/api'
// Ping backend on startup so Railway wakes up before the user submits any form.
// iOS WKWebView throws "Load failed" if the first POST hits a cold-start server.
function warmupBackend() {
  fetch(`${API_URL}/health`, { method: 'GET' }).catch(() => {/* ignore — just waking it up */})
}

export default function App() {
  const { setUser } = useAuthStore()
  useEffect(() => {
    warmupBackend()
    // Timeout fallback: if Supabase doesn't respond, show auth page (prevents blank screen on iOS)
    const timeout = setTimeout(() => { setUser(null) }, 8000)
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout)
      setUser(session?.user ?? null)
    }).catch(() => { clearTimeout(timeout); setUser(null) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { setUser(session?.user ?? null) })
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [setUser])

  return (
    <Routes>
      {/* Public */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/portal/:token" element={<ClientPortalPage />} />
      <Route path="/satisfaction/:token" element={<SatisfactionPage />} />

      {/* App */}
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
