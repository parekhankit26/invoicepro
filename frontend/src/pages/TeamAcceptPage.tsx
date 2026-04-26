import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, CheckCircle } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

export default function TeamAcceptPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    fetch(`${API}/team/accept/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else { setInvite(d); setFullName(d.member?.full_name || '') }
      })
      .catch(() => setError('Failed to load invite'))
      .finally(() => setLoading(false))
  }, [token])

  const handleAccept = async () => {
    if (!password || password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirmPw) return setError('Passwords do not match')
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`${API}/team/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, full_name: fullName })
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Failed to accept invite')
      setDone(true)
      setTimeout(() => navigate('/team/login'), 2500)
    } catch { setError('Something went wrong. Please try again.') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4' }}>
      <div style={{ color: '#756d5c', fontSize: 13 }}>Loading invite...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#1a1814', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {done ? (
          <>
            <div style={{ width: 56, height: 56, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle size={28} color="#16a34a" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>You're in! 🎉</h1>
            <p style={{ color: '#756d5c', fontSize: 14 }}>Account created. Redirecting to login...</p>
          </>
        ) : error && !invite ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Invalid invite</h1>
            <p style={{ color: '#756d5c', fontSize: 14 }}>{error}</p>
          </>
        ) : (
          <>
            <div style={{ width: 44, height: 44, background: '#1a1814', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Zap size={20} color="#a3e635" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>You've been invited</h1>
            <p style={{ color: '#756d5c', fontSize: 14, marginBottom: 6 }}>
              Join <strong>{invite?.owner_company || 'your team'}</strong> on InvoicePro
            </p>
            <div style={{ background: '#f8f7f4', borderRadius: 10, padding: '10px 16px', marginBottom: 24, fontSize: 13 }}>
              <span style={{ color: '#756d5c' }}>Role: </span>
              <strong style={{ textTransform: 'capitalize' }}>{invite?.member?.role || 'Staff'}</strong>
              <span style={{ color: '#756d5c', margin: '0 8px' }}>·</span>
              <span style={{ color: '#756d5c' }}>{invite?.member?.email}</span>
            </div>

            <div style={{ textAlign: 'left', marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#756d5c', display: 'block', marginBottom: 5 }}>Your name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e8e5de', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ textAlign: 'left', marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#756d5c', display: 'block', marginBottom: 5 }}>Create password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  style={{ width: '100%', padding: '9px 40px 9px 12px', border: '1px solid #e8e5de', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#756d5c' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'left', marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#756d5c', display: 'block', marginBottom: 5 }}>Confirm password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter password"
                onKeyDown={e => e.key === 'Enter' && handleAccept()}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e8e5de', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>

            {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 14, background: '#fef2f2', padding: '8px 12px', borderRadius: 7 }}>{error}</div>}

            <button onClick={handleAccept} disabled={submitting}
              style={{ width: '100%', padding: 12, background: '#1a1814', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit' }}>
              {submitting ? 'Creating account...' : 'Accept invite & create account →'}
            </button>
            <p style={{ marginTop: 14, fontSize: 12, color: '#b8b2a3' }}>Already have an account? <a href="/team/login" style={{ color: '#1a1814', fontWeight: 600 }}>Sign in</a></p>
          </>
        )}
      </div>
    </div>
  )
}
