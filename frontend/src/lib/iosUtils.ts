import toast from 'react-hot-toast'

// Safe clipboard write — falls back to execCommand for older WKWebView
export async function copyToClipboard(text: string, successMsg = 'Copied!'): Promise<void> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    toast.success(successMsg)
  } catch {
    toast.error('Could not copy — please copy manually')
  }
}

// Open external URL safely — uses _system to open in Safari on iOS Capacitor,
// avoiding the trapped WKWebView with no navigation chrome
export function openExternalUrl(url: string): void {
  try {
    window.open(url, '_system')
  } catch {
    window.open(url, '_blank')
  }
}

// Download PDF — on iOS Capacitor, anchor .click() is silently ignored in WKWebView.
// Instead we load the PDF blob into a new window (Safari handles PDF inline).
export async function downloadPDF(
  apiUrl: string,
  invoiceId: string,
  invoiceNumber: string,
  headers: Record<string, string>
): Promise<void> {
  const res = await fetch(`${apiUrl}/invoices/${invoiceId}/pdf`, { headers })
  if (!res.ok) throw new Error('Failed to generate PDF')
  const blob = await res.blob()

  // Try anchor download first (works on web browsers)
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch {
    // Fallback for WKWebView: open blob as data URL in a new window (Safari's PDF viewer)
    const reader = new FileReader()
    reader.onload = () => { window.open(reader.result as string, '_system') }
    reader.readAsDataURL(blob)
  }
}
