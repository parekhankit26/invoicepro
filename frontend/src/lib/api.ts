import { supabase } from './supabase'

// Always use the Railway backend URL directly - Vercel doesn't proxy /api
const API_URL = (import.meta as any).env?.VITE_API_URL || 'https://invoicepro-production-2ed7.up.railway.app/api'

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  if (data?.session?.access_token) return data.session.access_token
  return localStorage.getItem('team_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    let errMsg = `Request failed: ${res.status}`
    let upgradeRequired = false
    try {
      const err = await res.json()
      errMsg = err.error || err.message || errMsg
      upgradeRequired = err.upgrade_required || false
    } catch {}
    const error = new Error(errMsg) as any
    error.upgradeRequired = upgradeRequired
    throw error
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: any) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  downloadPDF: async (invoiceId: string, invoiceNumber: string) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(`${API_URL}/invoices/${invoiceId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'PDF generation failed' }))
      throw new Error(err.error || 'Failed to generate PDF')
    }
    const blob = new Blob([await res.arrayBuffer()], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}

// Constant for non-hook contexts (portal, satisfaction, team pages)
export const API_BASE = API_URL
