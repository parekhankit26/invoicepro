import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Zap, Loader } from 'lucide-react'
import { api } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { modalState } from '../lib/modalState'

interface Message { role: 'user' | 'assistant'; content: string }

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false) // hides when modal is open
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: "Hi! I'm your InvoicePro AI assistant. Ask me anything — \"Who hasn't paid me?\", \"What's my revenue this month?\", \"Create an invoice for £500\""
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Hide AI button when any modal is open
  useEffect(() => {
    return modalState.subscribe(isOpen => {
      setHidden(isOpen)
      if (isOpen) setOpen(false)
    })
  }, [])

  useEffect(() => {
    if (open && suggestions.length === 0) {
      api.get<string[]>('/ai/suggestions').then(setSuggestions).catch(() => {})
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const history = messages.slice(-8)
      const data = await api.post<any>('/ai/chat', { message: msg, conversation_history: history })
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      if (data.action?.type === 'create_invoice' && data.action?.result?.invoice_id) {
        setTimeout(() => navigate(`/invoices/${data.action.result.invoice_id}`), 1500)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }])
    } finally { setLoading(false) }
  }

  if (hidden) return null

  const panelStyle: React.CSSProperties = isMobile ? {
    position: 'fixed', inset: 0, width: '100%', height: '100%',
    borderRadius: 0, zIndex: 1001,
  } : {
    position: 'fixed', bottom: 88, right: 24,
    width: 'min(380px, calc(100vw - 32px))',
    height: 'min(520px, calc(100vh - 120px))',
    borderRadius: 16, zIndex: 999,
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label="AI Assistant"
        style={{
          position: 'fixed',
          bottom: 'max(24px, calc(16px + env(safe-area-inset-bottom)))',
          right: 24,
          width: 52, height: 52, borderRadius: '50%',
          background: '#1a1814', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 1000,
          transition: 'transform 0.15s, opacity 0.15s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {open ? <X size={20} color="white"/> : <MessageSquare size={20} color="white"/>}
      </button>

      {open && (
        <div style={{ ...panelStyle, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: '#1a1814', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#a3e635', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={16} color="#1a1814"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>AI Assistant</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Ask me anything</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', padding: 6, borderRadius: 6 }}>
              <X size={18}/>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '86%', padding: '9px 13px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? '#1a1814' : 'var(--bg)',
                  color: msg.role === 'user' ? 'white' : 'var(--text)',
                  fontSize: 13.5, lineHeight: 1.55,
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-subtle)', animation: `bounce 1s ${i*0.2}s infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {messages.length === 1 && suggestions.length > 0 && (
            <div style={{ padding: '0 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {suggestions.slice(0, 4).map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
              ))}
            </div>
          )}

          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, paddingBottom: isMobile ? 'max(10px, env(safe-area-inset-bottom))' : '10px' }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask anything..." disabled={loading}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              style={{ width: 40, height: 40, borderRadius: 8, background: '#1a1814', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !input.trim() || loading ? 0.5 : 1, flexShrink: 0 }}>
              {loading ? <Loader size={15} color="white"/> : <Send size={15} color="white"/>}
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </>
  )
}
