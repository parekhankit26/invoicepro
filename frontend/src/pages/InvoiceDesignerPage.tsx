import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Download } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import toast from 'react-hot-toast'

const TEMPLATES = [
  { id: 'classic', name: 'Classic', desc: 'Clean black header, professional' },
  { id: 'modern', name: 'Modern', desc: 'Minimalist with accent colour' },
  { id: 'bold', name: 'Bold', desc: 'Large typography, striking' },
  { id: 'minimal', name: 'Minimal', desc: 'White space, ultra clean' },
]

const FONTS = ['DM Sans', 'Inter', 'Georgia', 'Helvetica', 'Roboto']
const COLOURS = ['#1a1814', '#1e40af', '#7c3aed', '#0f766e', '#b45309', '#dc2626', '#374151']

export default function InvoiceDesignerPage() {
  const [template, setTemplate] = useState('classic')
  const [primaryColor, setPrimaryColor] = useState('#1a1814')
  const [accentColor, setAccentColor] = useState('#a3e635')
  const [font, setFont] = useState('DM Sans')
  const [showLogo, setShowLogo] = useState(true)
  const [footerText, setFooterText] = useState('Thank you for your business!')
  const [saved, setSaved] = useState(false)

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })

  const saveTemplate = async () => {
    try {
      await api.put('/auth/profile', {
        invoice_template: JSON.stringify({ template, primaryColor, accentColor, font, showLogo, footerText })
      })
      setSaved(true)
      toast.success('Invoice template saved! New invoices will use this design.')
      setTimeout(() => setSaved(false), 3000)
    } catch { toast.error('Failed to save template') }
  }

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Invoice designer</h1><p className="page-subtitle">Customise how your invoices look to clients</p></div>
        <button className="btn btn-primary" onClick={saveTemplate}>{saved ? '✓ Saved!' : 'Save template'}</button>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          {/* Controls */}
          <div>
            <div className="card card-p" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Template style</div>
              {TEMPLATES.map(t => (
                <div key={t.id} onClick={() => setTemplate(t.id)}
                  style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${template === t.id ? 'var(--text)' : 'var(--border)'}`, marginBottom: 8, cursor: 'pointer', background: template === t.id ? 'var(--bg)' : 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{t.desc}</div>
                </div>
              ))}
            </div>

            <div className="card card-p" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Colours</div>
              <div className="form-group">
                <label className="form-label">Primary (header background)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {COLOURS.map(c => (
                    <div key={c} onClick={() => setPrimaryColor(c)}
                      style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer', border: primaryColor === c ? '2px solid var(--text)' : '2px solid transparent', outline: primaryColor === c ? '2px solid white' : 'none' }} />
                  ))}
                </div>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Accent (highlights)</label>
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
              </div>
            </div>

            <div className="card card-p" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Typography & options</div>
              <div className="form-group">
                <label className="form-label">Font</label>
                <select className="form-select" value={font} onChange={e => setFont(e.target.value)}>
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Footer text</label>
                <input className="form-input" value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Thank you for your business!" />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} style={{ width: 'auto' }} />
                Show company logo on invoices
              </label>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={14} /> Live preview</div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', fontFamily: font }}>
              {/* Header */}
              <div style={{ background: primaryColor, padding: '28px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>{profile?.company_name || 'Your Company'}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>{profile?.company_address || 'Your address · VAT: GB123456789'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>INVOICE</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>INV-0001</div>
                  <div style={{ display: 'inline-block', background: accentColor, color: primaryColor, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, marginTop: 6 }}>DRAFT</div>
                </div>
              </div>

              {/* Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, padding: '20px 36px', background: '#f8f7f4', borderBottom: '1px solid #e8e5de' }}>
                {[['Bill to', 'Acme Ltd\nacme@example.com'], ['Issue date', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })], ['Amount due', '£2,400.00']].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#756d5c', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: label === 'Amount due' ? 700 : 400, color: label === 'Amount due' ? primaryColor : '#1a1814', whiteSpace: 'pre-line' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Items */}
              <div style={{ padding: '20px 36px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
                  <thead>
                    <tr style={{ background: primaryColor }}>
                      {['Description', 'Qty', 'Unit price', 'Amount'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Description' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[['Website design & development', '1', '£2,000.00', '£2,000.00'], ['SEO optimisation', '1', '£400.00', '£400.00']].map(([desc, qty, price, total]) => (
                      <tr key={desc} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{desc}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', color: '#756d5c' }}>{qty}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right' }}>{price}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', fontWeight: 500 }}>{total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 240 }}>
                    {[['Subtotal', '£2,400.00'], ['VAT (20%)', '£480.00']].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#756d5c', borderBottom: '1px solid #f1f5f9' }}><span>{l}</span><span>{v}</span></div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, fontWeight: 700, borderTop: `2px solid ${primaryColor}`, marginTop: 4, color: primaryColor }}>
                      <span>Total</span><span>£2,880.00</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e8e5de', fontSize: 12, color: '#756d5c', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{footerText}</span>
                  <span style={{ color: accentColor, fontWeight: 600 }}>Powered by InvoicePro</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
