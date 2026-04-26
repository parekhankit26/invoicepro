import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

export default function TeamLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) return setError('Email and password required')
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/team/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Login failed')

      // Store team member session
      localStorage.setItem('team_token', data.token)
      localStorage.setItem('team_membership', JSON.stringify(data.membership))
      localStorage.setItem('team_user', JSON.stringify(data.user))

      navigate('/team/dashboard')
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1814', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, background: '#1a1814', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Zap size={20} color="#a3e635" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Team member login</h1>
        <p style={{ color: '#756d5c', fontSize: 13, marginBottom: 28 }}>Sign in to your team account</p>

        <div style={{ textAlign: 'left', marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#756d5c', display: 'block', marginBottom: 5 }}>Email address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e8e5de', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        <div style={{ textAlign: 'left', marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#756d5c', display: 'block', marginBottom: 5 }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '9px 40px 9px 12px', border: '1px solid #e8e5de', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#756d5c' }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 14, background: '#fef2f2', padding: '8px 12px', borderRadius: 7 }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: 12, background: '#1a1814', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit', marginBottom: 16 }}>
          {loading ? 'Signing in...' : 'Sign in →'}
        </button>

        <div style={{ borderTop: '1px solid #e8e5de', paddingTop: 16 }}>
          <p style={{ fontSize: 12, color: '#b8b2a3', marginBottom: 8 }}>Business owner? <a href="/auth" style={{ color: '#1a1814', fontWeight: 600 }}>Sign in here</a></p>
          <p style={{ fontSize: 12, color: '#b8b2a3' }}>Got an invite? <a href="#" style={{ color: '#1a1814', fontWeight: 600 }}>Check your email for the link</a></p>
        </div>
      </div>
    </div>
  )
}
