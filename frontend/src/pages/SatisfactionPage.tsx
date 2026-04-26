import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || '/api'

export default function SatisfactionPage() {
  const [params] = useSearchParams()
  const score = parseInt(params.get('score') || '0')
  const token = window.location.pathname.split('/satisfaction/')[1]
  const [submitted, setSubmitted] = useState(false)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const labels = ['', 'Very poor', 'Poor', 'Average', 'Good', 'Excellent']
  const colours = ['', '#dc2626', '#f97316', '#f59e0b', '#22c55e', '#16a34a']

  const submit = async (finalScore: number) => {
    setLoading(true)
    try {
      await fetch(`${API}/features/satisfaction/respond/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore, comment })
      })
      setSubmitted(true)
    } catch { setSubmitted(true) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (score >= 1 && score <= 5 && token) submit(score) }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: 20 }}>
      <div style={{ background: 'white', border: '1px solid #e8e5de', borderRadius: 16, padding: 40, maxWidth: 440, width: '100%', textAlign: 'center' }}>
        {submitted ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Thank you!</h1>
            <p style={{ color: '#756d5c', fontSize: 14 }}>Your feedback means a lot and helps us improve our service.</p>
          </>
        ) : score >= 1 ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{['', '😞', '😕', '😐', '🙂', '😄'][score]}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: colours[score], marginBottom: 16 }}>{labels[score]}</div>
            <p style={{ color: '#756d5c', fontSize: 14, marginBottom: 20 }}>Would you like to add a comment? (optional)</p>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tell us more..." rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8e5de', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginBottom: 16 }} />
            <button onClick={() => submit(score)} disabled={loading}
              style={{ width: '100%', padding: 12, background: '#1a1814', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Submitting...' : 'Submit feedback'}
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>How did we do?</h1>
            <p style={{ color: '#756d5c', fontSize: 14, marginBottom: 24 }}>Rate your experience</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => submit(n)}
                  style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid #e8e5de', background: '#f8f7f4', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {['😞','😕','😐','🙂','😄'][n-1]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
