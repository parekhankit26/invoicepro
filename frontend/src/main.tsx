import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#1a1814', color: '#f8f7f4', borderRadius: '10px', fontSize: '13.5px', fontFamily: 'DM Sans, sans-serif' }, success: { iconTheme: { primary: '#22c55e', secondary: '#1a1814' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#1a1814' } } }} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
