import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1814', color: '#f8f7f4', padding: 32, textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 200 200" fill="none" style={{ marginBottom: 20 }}>
            <rect width="200" height="200" rx="40" fill="#1a1814" />
            <rect x="40" y="36" width="90" height="10" rx="5" fill="white" />
            <rect x="40" y="58" width="68" height="10" rx="5" fill="white" opacity="0.5" />
            <circle cx="148" cy="154" r="36" fill="#a3e635" />
            <path d="M136 154 L144 162 L162 144" stroke="#1a1814" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#756d5c', marginBottom: 24 }}>Please close and reopen the app.</div>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#a3e635', color: '#1a1814', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="bottom-right"
            containerStyle={{ bottom: 'max(16px, env(safe-area-inset-bottom))', right: 'max(16px, env(safe-area-inset-right))' }}
            toastOptions={{ style: { background: '#1a1814', color: '#f8f7f4', borderRadius: '10px', fontSize: '13.5px', fontFamily: 'DM Sans, sans-serif' }, success: { iconTheme: { primary: '#22c55e', secondary: '#1a1814' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#1a1814' } } }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
