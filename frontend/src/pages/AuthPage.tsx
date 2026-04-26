import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Zap, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../lib/authStore'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuthStore()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<any>()

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      if (mode === 'login') { await signIn(data.email, data.password); toast.success('Welcome back!'); navigate('/dashboard') }
      else { await signUp(data.email, data.password, data.full_name, data.company_name); toast.success('Account created! Check your email.') }
    } catch (err: any) { toast.error(err.message || 'Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, background: '#1a1814', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Zap size={20} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>InvoicePro</h1>
          <p style={{ fontSize: 13, color: 'var(--text-subtle)', marginTop: 4 }}>{mode === 'login' ? 'Sign in to your account' : 'Create your free account'}</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {mode === 'register' && (
              <>
                <div className="form-group"><label className="form-label">Full name *</label><input {...register('full_name', { required: true })} className="form-input" placeholder="Jane Smith" /></div>
                <div className="form-group"><label className="form-label">Company name</label><input {...register('company_name')} className="form-input" placeholder="Acme Ltd (optional)" /></div>
              </>
            )}
            <div className="form-group"><label className="form-label">Email *</label><input {...register('email', { required: true })} className="form-input" type="email" placeholder="you@example.com" /></div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input {...register('password', { required: true, minLength: 8 })} className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••••" style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: 8 }} disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <div className="divider" />
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); reset() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
