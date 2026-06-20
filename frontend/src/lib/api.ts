import { supabase } from './supabase'
import { downloadPDF as iosPDF } from './iosUtils'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function getHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`
  return h
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options?.headers } })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  async downloadPDF(invoiceId: string, invoiceNumber: string) {
    const headers = await getHeaders()
    await iosPDF(API_URL, invoiceId, invoiceNumber, headers)
  },
}
