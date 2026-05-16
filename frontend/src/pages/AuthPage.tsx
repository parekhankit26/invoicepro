import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Zap, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../lib/authStore'
import { supabase } from '../lib/supabase'
import { API_BASE } from '../lib/api'
import toast from 'react-hot-toast'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const { signIn } = useAuthStore()
  const navigate = useNavigate()
  const { register, handleSubmit, reset, watch } = useForm<any>()

  // Handle password reset callback from email link
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setMode('reset')
    }
    // Also check for Supabase auth state change (password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
    })
    return () => subscription.unsubscribe()
  }, [])

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(data.email, data.password)
        toast.success('Welcome back!')
        navigate('/dashboard')

      } else if (mode === 'register') {
        // Use backend route — auto-confirms email, no email verification needed
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            full_name: data.full_name,
            company_name: data.company_name || ''
          })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Registration failed')

        // Auto sign in after registration
        await signIn(data.email, data.password)
        toast.success('Account created! Welcome to InvoicePro 🎉')
        navigate('/dashboard')

      } else if (mode === 'forgot') {
        // Use our backend endpoint — sends via Resend/SMTP from admin panel config
        // (bypasses Supabase's rate-limited free-tier email)
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email })
        })
        const result = await res.json()
        setResetEmail(data.email)
        if (result.dev_reset_url) {
          // Dev mode: open the link directly (email not configured)
          toast.success('Dev mode: opening reset link...')
          window.open(result.dev_reset_url, '_blank')
        } else {
          toast.success(result.message || 'Reset link sent! Check your inbox.')
        }
        reset()

      } else if (mode === 'reset') {
        // User clicked link from email — now set new password
        if (data.password !== data.confirm_password) {
          throw new Error('Passwords do not match')
        }
        const { error } = await supabase.auth.updateUser({ password: data.password })
        if (error) throw error
        toast.success('Password updated! Please sign in.')
        // Clear the hash and go to login
        window.history.replaceState(null, '', window.location.pathname)
        setMode('login')
        reset()
      }
    } catch (err: any) {
      let msg = err.message || 'Something went wrong'
      // Friendly error messages
      if (msg.includes('already exists') || msg.includes('already registered')) {
        msg = 'This email is already registered. Click "Sign in" below.'
        setMode('login')
        reset({ email: data.email })
      } else if (msg.includes('Invalid login') || msg.includes('Invalid credentials')) {
        msg = 'Wrong email or password. Try again.'
      } else if (msg.includes('Email not confirmed')) {
        msg = 'Please check your email and click the confirmation link.'
      } else if (msg.includes('Database error')) {
        msg = 'Account creation failed. This email may already be registered — try signing in instead.'
        setMode('login')
      }
      toast.error(msg, { duration: 5000 })
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => { setMode('login'); reset(); setResetEmail('') }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: '#1a1814', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Zap size={20} color="white"/>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>InvoicePro</h1>
          <p style={{ fontSize: 13, color: 'var(--text-subtle)', marginTop: 4 }}>
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'register' && 'Create your free account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Set your new password'}
          </p>
        </div>

        <div className="card auth-card" style={{ padding: 28 }}>

          {/* Back button for non-login modes */}
          {mode !== 'login' && mode !== 'register' && (
            <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 13, marginBottom: 16, padding: 0 }}>
              <ArrowLeft size={14}/> Back to login
            </button>
          )}

          {/* FORGOT PASSWORD - sent confirmation */}
          {mode === 'forgot' && resetEmail && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Check your email</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                We sent a password reset link to<br/><strong>{resetEmail}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', background: 'var(--bg)', padding: '10px 14px', borderRadius: 8 }}>
                Click the link in the email then come back here to set your new password.
              </div>
              <button onClick={goBack} className="btn btn-secondary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
                Back to login
              </button>
            </div>
          )}

          {/* FORMS */}
          {!(mode === 'forgot' && resetEmail) && (
            <form onSubmit={handleSubmit(onSubmit)}>

              {/* Register fields */}
              {mode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full name *</label>
                    <input {...register('full_name', { required: true })} className="form-input" placeholder="Jane Smith"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company name</label>
                    <input {...register('company_name')} className="form-input" placeholder="Acme Ltd (optional)"/>
                  </div>
                </>
              )}

              {/* Email — all modes except reset */}
              {mode !== 'reset' && (
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input {...register('email', { required: true })} className="form-input" type="email" placeholder="you@example.com"/>
                </div>
              )}

              {/* Password — login, register, reset */}
              {mode !== 'forgot' && (
                <div className="form-group">
                  <label className="form-label">
                    {mode === 'reset' ? 'New password *' : 'Password *'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      {...register('password', { required: true, minLength: 8 })}
                      className="form-input"
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      style={{ paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex' }}>
                      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                  {/* Forgot password link */}
                  {mode === 'login' && (
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <button type="button" onClick={() => { setMode('forgot'); reset() }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 12 }}>
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm password for reset */}
              {mode === 'reset' && (
                <div className="form-group">
                  <label className="form-label">Confirm new password *</label>
                  <input {...register('confirm_password', { required: true })} className="form-input" type="password" placeholder="••••••••"/>
                </div>
              )}

              {/* Submit button */}
              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 8, fontSize: 14 }}
                disabled={loading}>
                {loading ? 'Please wait...' :
                  mode === 'login' ? 'Sign in →' :
                  mode === 'register' ? 'Create account →' :
                  mode === 'forgot' ? 'Send reset link' :
                  'Set new password →'}
              </button>
            </form>
          )}

          {/* Toggle login/register */}
          {(mode === 'login' || mode === 'register') && (
            <>
              <div className="divider"/>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); reset() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>
                  {mode === 'login' ? 'Sign up free' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>

        {/* Plan features teaser on register */}
        {mode === 'register' && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            {['✅ Free forever — no credit card', '✅ 5 invoices/month on free plan', '✅ Unlimited on paid plans from £9/mo'].map(f => (
              <div key={f} style={{ fontSize: 12, color: 'var(--text-subtle)', marginBottom: 4 }}>{f}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
