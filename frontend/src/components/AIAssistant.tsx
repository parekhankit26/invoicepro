import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Zap, Loader } from 'lucide-react'
import { api } from '../lib/api'
import { useNavigate } from 'react-router-dom'

interface Message { role: 'user' | 'assistant'; content: string; timestamp: Date }

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Hi! I\'m your InvoicePro AI assistant. Ask me anything about your business — "Who hasn\'t paid me?", "Create an invoice for £500", "What\'s my revenue this month?" — I\'ll handle it instantly.', timestamp: new Date() }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open && suggestions.length === 0) {
      api.get<string[]>('/ai/suggestions').then(setSuggestions).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: msg, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
      const data = await api.post<any>('/ai/chat', { message: msg, conversation_history: history })
      const assistantMsg: Message = { role: 'assistant', content: data.message, timestamp: new Date() }
      setMessages(prev => [...prev, assistantMsg])

      // Handle actions
      if (data.action?.type === 'create_invoice' && data.action?.result?.invoice_id) {
        setTimeout(() => navigate(`/invoices/${data.action.result.invoice_id}`), 1500)
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{ position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: '50%', background: '#1a1814', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 1000, transition: 'transform 0.2s' }}
        title="AI Assistant"
      >
        {open ? <X size={20} color="white" /> : <MessageSquare size={20} color="white" />}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{ position: 'fixed', bottom: 88, right: 24, width: 380, height: 520, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', zIndex: 999, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
          {/* Header */}
          <div style={{ background: '#1a1814', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#a3e635', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={16} color="#1a1814" />
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>AI Assistant</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Powered by Claude</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? '#1a1814' : 'var(--bg)',
                  color: msg.role === 'user' ? 'white' : 'var(--text)',
                  fontSize: 13, lineHeight: 1.5,
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-subtle)', animation: `bounce 1s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && suggestions.length > 0 && (
            <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {suggestions.slice(0, 4).map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask anything about your business..."
              style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              disabled={loading}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} style={{ width: 36, height: 36, borderRadius: 8, background: '#1a1814', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !input.trim() || loading ? 0.5 : 1 }}>
              {loading ? <Loader size={14} color="white" /> : <Send size={14} color="white" />}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }`}</style>
    </>
  )
}
