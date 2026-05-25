import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

const LS_KEY = 'invoicepro_template'
function loadLocalTemplate() {
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
function saveLocalTemplate(t: any) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(t)) } catch {}
}

const TEMPLATES = [
  { id: 'classic', name: 'Classic', desc: 'Clean dark header, professional' },
  { id: 'modern', name: 'Modern', desc: 'Minimalist with accent colour' },
  { id: 'bold', name: 'Bold', desc: 'Large typography, striking' },
  { id: 'minimal', name: 'Minimal', desc: 'White space, ultra clean' },
]

const FONTS = ['DM Sans', 'Inter', 'Georgia', 'Helvetica', 'Roboto']
const COLOURS = ['#1a1814', '#1e40af', '#7c3aed', '#0f766e', '#b45309', '#dc2626', '#374151']

const SAMPLE_ITEMS = [
  { desc: 'Website design & development', qty: 1, price: '£2,000.00', total: '£2,000.00' },
  { desc: 'SEO optimisation', qty: 1, price: '£400.00', total: '£400.00' },
]
const TODAY = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function InvoiceDesignerPage() {
  const local = loadLocalTemplate()
  const [template, setTemplate] = useState(local?.template || 'classic')
  const [primaryColor, setPrimaryColor] = useState(local?.primaryColor || '#1a1814')
  const [accentColor, setAccentColor] = useState(local?.accentColor || '#a3e635')
  const [font, setFont] = useState(local?.font || 'DM Sans')
  const [showLogo, setShowLogo] = useState(local?.showLogo !== undefined ? local.showLogo : true)
  const [footerText, setFooterText] = useState(local?.footerText || 'Thank you for your business!')
  const [saved, setSaved] = useState(false)

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })

  // If profile has a saved template and no local copy yet, load it
  useEffect(() => {
    if (profile?.invoice_template && !loadLocalTemplate()) {
      try {
        const t = typeof profile.invoice_template === 'string'
          ? JSON.parse(profile.invoice_template)
          : profile.invoice_template
        if (t) {
          if (t.template) setTemplate(t.template)
          if (t.primaryColor) setPrimaryColor(t.primaryColor)
          if (t.accentColor) setAccentColor(t.accentColor)
          if (t.font) setFont(t.font)
          if (t.showLogo !== undefined) setShowLogo(t.showLogo)
          if (t.footerText) setFooterText(t.footerText)
        }
      } catch {}
    }
  }, [profile])

  const saveTemplate = async () => {
    const tpl = { template, primaryColor, accentColor, font, showLogo, footerText }
    // Always save to localStorage first — works even if DB column doesn't exist yet
    saveLocalTemplate(tpl)
    try {
      await api.put('/auth/profile', { invoice_template: JSON.stringify(tpl) })
      setSaved(true)
      toast.success('Template saved! New invoices will use this design.')
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // LocalStorage save already succeeded — user's template is safe
      setSaved(true)
      toast.success('Template saved locally!')
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const companyName = profile?.company_name || 'Your Company'
  const companyAddress = profile?.company_address || 'Your address'
  const vatNumber = profile?.tax_number ? `VAT: ${profile.tax_number}` : 'VAT: GB123456789'
  const logoUrl = showLogo && profile?.company_logo ? profile.company_logo : null

  // ── Template-specific live previews ───────────────────
  const renderPreview = () => {
    const itemsTable = (headerBg: string, headerColor: string, headerBorder?: string) => (
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ background: headerBg, borderBottom: headerBorder }}>
            {['Description', 'Qty', 'Unit price', 'Amount'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Description' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: headerColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map(item => (
            <tr key={item.desc} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 12px', fontSize: 13 }}>{item.desc}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', color: '#756d5c' }}>{item.qty}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right' }}>{item.price}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right', fontWeight: 500 }}>{item.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )

    const totalsBlock = (totalColor: string) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 240 }}>
          {[['Subtotal', '£2,400.00'], ['VAT (20%)', '£480.00']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#756d5c', borderBottom: '1px solid #f1f5f9' }}>
              <span>{l}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, fontWeight: 700, borderTop: `2px solid ${totalColor}`, marginTop: 4, color: totalColor }}>
            <span>Total</span><span>£2,880.00</span>
          </div>
        </div>
      </div>
    )

    const footerBar = (bg = '#f8f7f4', border = '#e8e5de') => (
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${border}`, background: bg, fontSize: 12, color: '#756d5c', display: 'flex', justifyContent: 'space-between' }}>
        <span>{footerText}</span>
        <span style={{ color: accentColor, fontWeight: 600 }}>Powered by InvoicePro</span>
      </div>
    )

    if (template === 'classic') {
      return (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', fontFamily: font }}>
          {/* Classic: full-colour header */}
          <div style={{ background: primaryColor, padding: '28px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 36, marginBottom: 8, display: 'block' }} />}
              <div style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>{companyName}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>{companyAddress} · {vatNumber}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>INVOICE</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>INV-0001</div>
              <div style={{ display: 'inline-block', background: accentColor, color: primaryColor, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, marginTop: 6 }}>DRAFT</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '20px 36px', background: '#f8f7f4', borderBottom: '1px solid #e8e5de' }}>
            {[['Bill to', 'Acme Ltd\nacme@example.com'], ['Issue date', TODAY], ['Amount due', '£2,880.00']].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#756d5c', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: label === 'Amount due' ? 700 : 400, color: label === 'Amount due' ? primaryColor : '#1a1814', whiteSpace: 'pre-line' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '20px 36px' }}>
            {itemsTable(primaryColor, 'white')}
            {totalsBlock(primaryColor)}
            {footerBar()}
          </div>
        </div>
      )
    }

    if (template === 'modern') {
      return (
        <div style={{ background: 'white', border: `1px solid var(--border)`, borderRadius: 12, overflow: 'hidden', fontFamily: font, borderLeft: `4px solid ${primaryColor}` }}>
          {/* Modern: white header, accent left border, coloured company name */}
          <div style={{ padding: '28px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid #e8e5de` }}>
            <div>
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 36, marginBottom: 8, display: 'block' }} />}
              <div style={{ color: primaryColor, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>{companyName}</div>
              <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>{companyAddress} · {vatNumber}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invoice</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1814' }}>INV-0001</div>
              <div style={{ display: 'inline-block', background: accentColor, color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, marginTop: 6 }}>DRAFT</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 36px', borderBottom: `1px solid #f1f5f9` }}>
            {[['Bill to', 'Acme Ltd\nacme@example.com'], ['Issue date', TODAY], ['Amount due', '£2,880.00']].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: label === 'Amount due' ? 700 : 400, color: label === 'Amount due' ? primaryColor : '#374151', whiteSpace: 'pre-line' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '20px 36px' }}>
            {itemsTable('transparent', '#9ca3af', `2px solid ${primaryColor}`)}
            {totalsBlock(primaryColor)}
            {footerBar('white', '#f1f5f9')}
          </div>
        </div>
      )
    }

    if (template === 'bold') {
      return (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', fontFamily: font }}>
          {/* Bold: oversized company name, thick accent stripe */}
          <div style={{ background: primaryColor, padding: '32px 36px 24px' }}>
            {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 44, marginBottom: 10, display: 'block' }} />}
            <div style={{ color: 'white', fontWeight: 900, fontSize: 32, letterSpacing: '-0.04em', lineHeight: 1 }}>{companyName}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 6 }}>{companyAddress} · {vatNumber}</div>
            <div style={{ height: 5, background: accentColor, borderRadius: 3, marginTop: 20 }} />
          </div>
          <div style={{ padding: '20px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafaf9', borderBottom: '1px solid #e8e5de' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#756d5c' }}>Bill to</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>Acme Ltd</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>acme@example.com</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, fontSize: 28, letterSpacing: '-0.03em', color: primaryColor }}>£2,880.00</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Invoice INV-0001 · {TODAY}</div>
              <div style={{ display: 'inline-block', background: accentColor, borderRadius: 4, padding: '2px 10px', fontSize: 10, fontWeight: 800, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Draft</div>
            </div>
          </div>
          <div style={{ padding: '20px 36px' }}>
            {itemsTable(accentColor, primaryColor)}
            {totalsBlock(primaryColor)}
            {footerBar()}
          </div>
        </div>
      )
    }

    // Minimal
    return (
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', fontFamily: font }}>
        {/* Minimal: all white, thin lines only, subtle typography */}
        <div style={{ padding: '32px 36px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 32, marginBottom: 8, display: 'block' }} />}
              <div style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>{companyName}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{companyAddress}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{vatNumber}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', color: '#111827' }}>Invoice</div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>INV-0001</div>
              <div style={{ width: 60, height: 2, background: primaryColor, marginLeft: 'auto', marginTop: 8 }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 36px', borderBottom: '1px solid #f3f4f6' }}>
          {[['Bill to', 'Acme Ltd\nacme@example.com'], ['Date', TODAY], ['Total', '£2,880.00']].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#d1d5db', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: label === 'Total' ? primaryColor : '#374151', fontWeight: label === 'Total' ? 700 : 400, whiteSpace: 'pre-line' }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '20px 36px' }}>
          {itemsTable('#f9fafb', '#9ca3af', undefined)}
          {totalsBlock(primaryColor)}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#d1d5db', display: 'flex', justifyContent: 'space-between' }}>
            <span>{footerText}</span>
            <span style={{ color: primaryColor }}>Powered by InvoicePro</span>
          </div>
        </div>
      </div>
    )
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
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Eye size={14} /> Live preview — {TEMPLATES.find(t => t.id === template)?.name}
            </div>
            {renderPreview()}
          </div>
        </div>
      </div>
    </>
  )
}
