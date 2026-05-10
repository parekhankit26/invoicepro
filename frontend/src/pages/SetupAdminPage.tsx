import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'

const ADMIN_SQL = `CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin','admin','support')),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

NOTIFY pgrst, 'reload schema';
SELECT 'Admin tables ready' as status;`

export default function SetupAdminPage() {
  const [step, setStep] = useState(1)
  const [status, setStatus] = useState<any>(null)
  const [form, setForm] = useState({ email: 'admin@invoicepro.app', password: '', full_name: 'Super Admin', setup_key: 'InvoiceProSetup2024' })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { checkStatus() }, [])

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/setup-status`)
      const data = await res.json()
      setStatus(data)
      if (data.tables_exist) setStep(2)
      if (data.admin_count > 0) setStep(3)
    } catch { setStatus({ error: 'Cannot reach backend' }) }
  }

  const copySQL = () => {
    navigator.clipboard.writeText(ADMIN_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/setup-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data)
      setStep(3)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const inp = (style = {}) => ({ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const, ...style })
  const lbl = { display:'block' as const, fontSize:12.5, fontWeight:500, color:'#6b7280', marginBottom:5 }

  return (
    <div style={{ minHeight:'100vh', background:'#f8f7f4', padding:20, fontFamily:'DM Sans, sans-serif' }}>
      <div style={{ maxWidth:560, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28, marginTop:8 }}>
          <svg width="36" height="36" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="40" fill="#1a1814"/><rect x="40" y="36" width="90" height="10" rx="5" fill="white"/><rect x="40" y="58" width="68" height="10" rx="5" fill="white" opacity="0.5"/><circle cx="148" cy="154" r="36" fill="#a3e635"/><path d="M136 154 L144 162 L162 144" stroke="#1a1814" strokeWidth="5" strokeLinecap="round" fill="none"/></svg>
          <div>
            <div style={{ fontWeight:800, fontSize:18, letterSpacing:'-0.03em' }}>InvoicePro</div>
            <div style={{ fontSize:12, color:'#9ca3af' }}>Super Admin Setup</div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display:'flex', gap:4, marginBottom:28 }}>
          {['Run SQL in Supabase','Create admin account','Done!'].map((s, i) => (
            <div key={i} style={{ flex:1, textAlign:'center' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background: step > i+1 ? '#16a34a' : step === i+1 ? '#1a1814' : '#e5e7eb', color: step >= i+1 ? 'white' : '#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', fontSize:13, fontWeight:700 }}>{step > i+1 ? '✓' : i+1}</div>
              <div style={{ fontSize:11, color: step === i+1 ? '#1a1814' : '#9ca3af', fontWeight: step === i+1 ? 600 : 400 }}>{s}</div>
            </div>
          ))}
        </div>

        {/* STEP 1: SQL */}
        {step === 1 && (
          <div style={{ background:'white', borderRadius:16, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>Step 1 — Run SQL in Supabase</h2>
            <p style={{ fontSize:13, color:'#6b7280', marginBottom:16, lineHeight:1.6 }}>
              First, create the admin tables in your database. Copy the SQL below and run it in <strong>Supabase → SQL Editor → New query</strong>.
            </p>

            {status?.error && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:12, marginBottom:16, fontSize:13, color:'#dc2626' }}>
                ⚠️ Backend status: {status.error}
              </div>
            )}

            <div style={{ position:'relative', marginBottom:16 }}>
              <pre style={{ background:'#1a1814', color:'#e2e8f0', borderRadius:10, padding:16, fontSize:12, overflow:'auto', lineHeight:1.6, margin:0, maxHeight:240 }}>
                {ADMIN_SQL}
              </pre>
              <button onClick={copySQL} style={{ position:'absolute', top:10, right:10, background:'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:12, marginBottom:20, fontSize:12.5, color:'#92400e' }}>
              📌 Go to <strong>supabase.com/dashboard</strong> → your project → <strong>SQL Editor</strong> → paste and click <strong>Run</strong>
            </div>

            <button onClick={checkStatus} style={{ width:'100%', padding:'12px', background:'#1a1814', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' }}>
              I ran the SQL — Check status
            </button>

            {status && !status.tables_exist && !status.error && (
              <div style={{ marginTop:10, fontSize:13, color:'#dc2626', textAlign:'center' }}>
                Tables not found yet — run the SQL above first
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Create admin */}
        {step === 2 && (
          <div style={{ background:'white', borderRadius:16, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:10, marginBottom:20, fontSize:13, color:'#16a34a', display:'flex', alignItems:'center', gap:6 }}>
              ✅ Database tables ready
            </div>
            <h2 style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>Step 2 — Create Super Admin Account</h2>
            <p style={{ fontSize:13, color:'#6b7280', marginBottom:20, lineHeight:1.6 }}>Fill your details below. The setup key is pre-filled.</p>

            <form onSubmit={createAdmin}>
              {[
                { key:'full_name', label:'Your full name', type:'text' },
                { key:'email', label:'Admin email', type:'email' },
                { key:'password', label:'Admin password (8+ characters)', type:'password' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={lbl}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} required
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={inp()}
                  />
                </div>
              ))}

              <div style={{ marginBottom:16 }}>
                <label style={lbl}>Setup key (pre-filled)</label>
                <input value={form.setup_key} readOnly style={inp({ background:'#f9fafb', color:'#9ca3af' })}/>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>Default key — change this in Railway env vars later</div>
              </div>

              {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', padding:'10px 12px', borderRadius:8, fontSize:13, marginBottom:14 }}>{error}</div>}

              <button type="submit" disabled={loading} style={{ width:'100%', padding:'13px', background:'#1a1814', color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer' }}>
                {loading ? 'Creating...' : 'Create Super Admin Account'}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 3 && (
          <div style={{ background:'white', borderRadius:16, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
            <h2 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>
              {result ? 'Super Admin Created!' : 'Admin Already Exists'}
            </h2>
            {result && (
              <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:16, marginBottom:20, textAlign:'left' }}>
                <div style={{ fontSize:13, marginBottom:4 }}><strong>Email:</strong> {result.admin?.email}</div>
                <div style={{ fontSize:13, marginBottom:4 }}><strong>Role:</strong> {result.admin?.role}</div>
                <div style={{ fontSize:13, color:'#16a34a' }}>✅ {result.message}</div>
              </div>
            )}
            {status?.admins && (
              <div style={{ background:'#f8f7f4', borderRadius:10, padding:16, marginBottom:20, textAlign:'left' }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:'#6b7280', marginBottom:8 }}>EXISTING ADMINS</div>
                {status.admins.map((a: any, i: number) => (
                  <div key={i} style={{ fontSize:13, marginBottom:4 }}>{a.email} — <span style={{ color:'#7c3aed' }}>{a.role}</span></div>
                ))}
              </div>
            )}
            <a href="https://invoicepro-production-2ed7.up.railway.app"
              target="_blank" rel="noreferrer"
              style={{ display:'block', width:'100%', padding:'13px', background:'#1a1814', color:'white', borderRadius:8, fontSize:15, fontWeight:600, textDecoration:'none', marginBottom:12 }}>
              Open Admin Panel →
            </a>
            <div style={{ fontSize:12, color:'#9ca3af' }}>⚠️ Add ADMIN_SETUP_KEY to Railway env vars to secure this endpoint</div>
          </div>
        )}
      </div>
    </div>
  )
}
