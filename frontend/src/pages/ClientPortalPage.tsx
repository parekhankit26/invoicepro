import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, CheckCircle, Clock, AlertTriangle, Download, CreditCard, Zap } from 'lucide-react'
import { formatCurrency, formatDate, getStatusClass } from '../lib/utils'

const API = (import.meta as any).env?.VITE_API_URL || 'https://invoicepro-production-2ed7.up.railway.app/api'

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

  // Parse bank details from business profile
  const bankDetails = (() => {
    try {
      const raw = business?.bank_account_details
      if (!raw) return null
      const b = typeof raw === 'string' ? JSON.parse(raw) : raw
      return (b.account_number || b.iban || b.sort_code) ? b : null
    } catch { return null }
  })()
  const outstanding = invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled')
  const paid = invoices.filter((i: any) => i.status === 'paid')

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1814', color: 'white', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px) 16px' }}>
        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Hello, {client?.name} 👋</h1>
          <p style={{ color: '#756d5c', fontSize: 14 }}>View your invoices, check payment status, and pay securely online.</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }} className='dash-kpi-grid'>
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
              <InvoiceCard key={inv.id} invoice={inv} token={token!} bankDetails={bankDetails} highlight />
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
            {paid.map((inv: any) => <InvoiceCard key={inv.id} invoice={inv} token={token!} bankDetails={null} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function InvoiceCard({ invoice: inv, token, bankDetails, highlight = false }: { invoice: any; token: string; bankDetails: any; highlight?: boolean }) {
  const [showBank, setShowBank] = useState(false)
  const isOverdue = inv.status !== 'paid' && new Date(inv.due_date) < new Date()
  const unpaid = inv.status !== 'paid' && inv.status !== 'cancelled'

  return (
    <div style={{
      background: 'white', borderRadius: 12, border: `1px solid ${highlight ? (isOverdue ? '#fecaca' : '#fef08a') : '#e8e5de'}`,
      padding: '16px 20px', marginBottom: 10
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: unpaid ? 12 : 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.invoice_number}</div>
          <div style={{ fontSize: 12, color: '#756d5c' }}>
            {inv.status === 'paid' ? `Paid ${formatDate(inv.paid_at)}` : `Due ${formatDate(inv.due_date)}`}
            {isOverdue && <span style={{ color: '#dc2626', marginLeft: 6, fontWeight: 600 }}>· OVERDUE</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{formatCurrency(inv.total, inv.currency)}</div>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: inv.status === 'paid' ? '#dcfce7' : isOverdue ? '#fee2e2' : '#fef9c3', color: inv.status === 'paid' ? '#15803d' : isOverdue ? '#dc2626' : '#b45309' }}>
            {inv.status === 'paid' ? '✓ Paid' : isOverdue ? 'Overdue' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Payment options — only for unpaid invoices */}
      {unpaid && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Online Pay button */}
          {inv.stripe_payment_link && (
            <a href={inv.stripe_payment_link} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', background: '#1a1814', color: 'white', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
              <CreditCard size={15} /> Pay {formatCurrency(inv.total, inv.currency)} online now →
            </a>
          )}

          {/* Bank Transfer option */}
          {bankDetails && (
            <div>
              <button onClick={() => setShowBank(v => !v)}
                style={{ width: '100%', padding: '11px', background: showBank ? '#f8f7f4' : 'white', border: '1px solid #e8e5de', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#374151' }}>
                🏦 {showBank ? 'Hide' : 'Pay by bank transfer'}
              </button>
              {showBank && (
                <div style={{ background: '#f8f7f4', borderRadius: 10, padding: '14px 16px', marginTop: 6, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: '#1a1814' }}>Bank transfer details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {bankDetails.account_holder_name && <Row label="Account name" value={bankDetails.account_holder_name} />}
                    {bankDetails.bank_name          && <Row label="Bank"         value={bankDetails.bank_name} />}
                    {bankDetails.account_number     && <Row label="Account no."  value={bankDetails.account_number} />}
                    {bankDetails.sort_code          && <Row label="Sort code"    value={bankDetails.sort_code} />}
                    {bankDetails.iban               && <Row label="IBAN"         value={bankDetails.iban} />}
                    {bankDetails.swift_bic          && <Row label="SWIFT/BIC"    value={bankDetails.swift_bic} />}
                    <Row label="Reference" value={inv.invoice_number} highlight />
                  </div>
                  {bankDetails.payment_instructions && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef9c3', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                      {bankDetails.payment_instructions}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No payment method available */}
          {!inv.stripe_payment_link && !bankDetails && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>
              Contact {inv.business_name || 'your supplier'} to arrange payment
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: highlight ? 700 : 500, color: highlight ? '#1a1814' : '#374151', fontSize: 13 }}>{value}</div>
    </div>
  )
}

async function respondToQuote(quoteToken: string, action: 'accept' | 'decline') {
  const API = (import.meta as any).env?.VITE_API_URL || 'https://invoicepro-production-2ed7.up.railway.app/api'
  try {
    await fetch(`${API}/quotes/portal/${quoteToken}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })
    window.location.reload()
  } catch { alert('Failed to respond. Please try again.') }
}
