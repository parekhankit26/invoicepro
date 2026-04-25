import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, CheckCircle, Clock, AlertTriangle, Download, CreditCard, Zap } from 'lucide-react'
import { formatCurrency, formatDate, getStatusClass } from '../lib/utils'

const API = import.meta.env.VITE_API_URL || '/api'

export default function ClientPortalPage() {
  const { token } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/portal/view/${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Failed to load portal'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f7f4' }}>
      <div style={{ textAlign: 'center', color: '#756d5c' }}>Loading your portal...</div>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f7f4' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Portal not found</h1>
        <p style={{ color: '#756d5c' }}>{error}</p>
      </div>
    </div>
  )

  const { client, business, invoices, quotes, stats } = data
  const outstanding = invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled')
  const paid = invoices.filter((i: any) => i.status === 'paid')

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1814', color: 'white', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {business?.company_logo && <img src={business.company_logo} alt="" style={{ height: 36, borderRadius: 6 }} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{business?.company_name || business?.full_name}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Client portal for {client?.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={14} color="#a3e635" />
          <span style={{ fontSize: 11, opacity: 0.5 }}>Powered by InvoicePro</span>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Hello, {client?.name} 👋</h1>
          <p style={{ color: '#756d5c', fontSize: 14 }}>View your invoices, check payment status, and pay securely online.</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            ['Total invoices', stats.total_invoices, '#1a1814'],
            ['Outstanding', formatCurrency(stats.outstanding), stats.outstanding > 0 ? '#b45309' : '#16a34a'],
            ['Invoices paid', stats.paid, '#16a34a'],
          ].map(([label, value, color]: any) => (
            <div key={label} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', border: '1px solid #e8e5de' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#756d5c', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Outstanding invoices */}
        {outstanding.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} color="#b45309" /> Outstanding invoices
            </h2>
            {outstanding.map((inv: any) => (
              <InvoiceCard key={inv.id} invoice={inv} token={token!} highlight />
            ))}
          </div>
        )}

        {/* Quotes pending */}
        {quotes.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={15} /> Pending quotes
            </h2>
            {quotes.map((q: any) => (
              <div key={q.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e5de', padding: '16px 20px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{q.quote_number}</div>
                    <div style={{ fontSize: 12, color: '#756d5c' }}>Expires {formatDate(q.expiry_date)}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{formatCurrency(q.total, q.currency)}</div>
                </div>
                {q.status === 'sent' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => respondToQuote(q.client_token, 'accept')}
                      style={{ flex: 1, padding: '10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                      ✓ Accept quote
                    </button>
                    <button onClick={() => respondToQuote(q.client_token, 'decline')}
                      style={{ padding: '10px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                      Decline
                    </button>
                  </div>
                )}
                {q.status === 'accepted' && <div style={{ color: '#16a34a', fontWeight: 600, fontSize: 13 }}>✓ Accepted</div>}
              </div>
            ))}
          </div>
        )}

        {/* Paid invoices */}
        {paid.length > 0 && (
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} color="#16a34a" /> Payment history
            </h2>
            {paid.map((inv: any) => <InvoiceCard key={inv.id} invoice={inv} token={token!} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function InvoiceCard({ invoice: inv, token, highlight = false }: { invoice: any; token: string; highlight?: boolean }) {
  const isOverdue = inv.status !== 'paid' && new Date(inv.due_date) < new Date()
  return (
    <div style={{
      background: 'white', borderRadius: 12, border: `1px solid ${highlight ? (isOverdue ? '#fecaca' : '#fef08a') : '#e8e5de'}`,
      padding: '16px 20px', marginBottom: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.invoice_number}</div>
          <div style={{ fontSize: 12, color: '#756d5c' }}>
            {inv.status === 'paid' ? `Paid ${formatDate(inv.paid_at)}` : `Due ${formatDate(inv.due_date)}`}
            {isOverdue && <span style={{ color: '#dc2626', marginLeft: 6 }}>· OVERDUE</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{formatCurrency(inv.total, inv.currency)}</div>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: inv.status === 'paid' ? '#dcfce7' : isOverdue ? '#fee2e2' : '#fef9c3', color: inv.status === 'paid' ? '#15803d' : isOverdue ? '#dc2626' : '#b45309' }}>
            {inv.status === 'paid' ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
          </span>
        </div>
      </div>
      {inv.status !== 'paid' && inv.stripe_payment_link && (
        <a href={inv.stripe_payment_link} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: '#1a1814', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
          <CreditCard size={14} /> Pay {formatCurrency(inv.total, inv.currency)} securely
        </a>
      )}
    </div>
  )
}

async function respondToQuote(quoteToken: string, action: 'accept' | 'decline') {
  const API = import.meta.env.VITE_API_URL || '/api'
  try {
    await fetch(`${API}/quotes/portal/${quoteToken}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })
    window.location.reload()
  } catch { alert('Failed to respond. Please try again.') }
}
