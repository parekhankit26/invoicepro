import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--border-strong)', lineHeight: 1, marginBottom: 16 }}>404</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Page not found</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={15}/> Go back
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            <Home size={15}/> Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
