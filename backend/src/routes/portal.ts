import { Router, Response, Request } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import crypto from 'crypto'

const router = Router()

// ── PUBLIC PORTAL (no auth needed) ──────────────────────

// Get portal data for a client via token
router.get('/view/:token', async (req: Request, res: Response) => {
  try {
    const { data: portal } = await supabase
      .from('client_portal_tokens')
      .select(`*, clients(*), profiles(company_name, full_name, company_logo, company_address, company_phone)`)
      .eq('token', (req as any).params.token)
      .eq('is_active', true)
      .single()

    if (!portal) return res.status(404).json({ error: 'Portal not found or inactive' })

    // Update last accessed
    await supabase.from('client_portal_tokens').update({ last_accessed: new Date().toISOString() }).eq('token', (req as any).params.token)

    // Get all invoices for this client
    const { data: invoices } = await supabase
      .from('invoices')
      .select(`*, invoice_items(*)`)
      .eq('client_id', portal.client_id)
      .eq('user_id', portal.user_id)
      .order('created_at', { ascending: false })

    // Get all quotes for this client
    const { data: quotes } = await supabase
      .from('quotes')
      .select(`*, quote_items(*)`)
      .eq('client_id', portal.client_id)
      .eq('user_id', portal.user_id)
      .in('status', ['sent', 'accepted'])
      .order('created_at', { ascending: false })

    const totalOutstanding = (invoices || [])
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((s, i) => s + i.total, 0)

    return res.json({
      client: portal.clients,
      business: portal.profiles,
      invoices: invoices || [],
      quotes: quotes || [],
      stats: {
        total_invoices: invoices?.length || 0,
        outstanding: totalOutstanding,
        paid: (invoices || []).filter(i => i.status === 'paid').length
      }
    })
  } catch {
    return res.status(500).json({ error: 'Failed to load portal' })
  }
})

// Client pays invoice via portal
router.post('/view/:token/invoices/:invoiceId/pay', async (req: Request, res: Response) => {
  try {
    const { data: portal } = await supabase
      .from('client_portal_tokens').select('*').eq('token', (req as any).params.token).eq('is_active', true).single()
    if (!portal) return res.status(404).json({ error: 'Portal not found' })

    const { data: invoice } = await supabase
      .from('invoices').select('*').eq('id', (req as any).params.invoiceId).eq('client_id', portal.client_id).single()
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    if (invoice.stripe_payment_link) {
      return res.json({ payment_link: invoice.stripe_payment_link })
    }
    return res.status(400).json({ error: 'No payment link available for this invoice' })
  } catch {
    return res.status(500).json({ error: 'Failed to get payment link' })
  }
})

// ── PROTECTED ROUTES ─────────────────────────────────────
router.use(authenticate)

// Generate portal token for a client
router.post('/generate/:clientId', async (req: AuthRequest, res: Response) => {
  try {
    const { data: client } = await supabase
      .from('clients').select('id, name').eq('id', (req as any).params.clientId).eq('user_id', (req as any).user!.id).single()
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const token = crypto.randomBytes(48).toString('base64url')

    // Upsert — regenerate if exists
    const { data, error } = await supabase
      .from('client_portal_tokens')
      .upsert({ user_id: (req as any).user!.id, client_id: (req as any).params.clientId, token, is_active: true }, { onConflict: 'user_id,client_id' })
      .select().single()
    if (error) return res.status(400).json({ error: error.message })

    const portalUrl = `${process.env.FRONTEND_URL}/portal/${token}`
    return res.json({ token, portal_url: portalUrl, client_name: client.name })
  } catch {
    return res.status(500).json({ error: 'Failed to generate portal' })
  }
})

// Get existing portal for a client
router.get('/client/:clientId', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('client_portal_tokens')
      .select('*').eq('client_id', (req as any).params.clientId).eq('user_id', (req as any).user!.id).single()
    if (error) return res.status(404).json({ error: 'No portal found for this client' })
    const portalUrl = `${process.env.FRONTEND_URL}/portal/${data.token}`
    return res.json({ ...data, portal_url: portalUrl })
  } catch {
    return res.status(500).json({ error: 'Failed to fetch portal' })
  }
})

// Deactivate portal
router.delete('/client/:clientId', async (req: AuthRequest, res: Response) => {
  try {
    await supabase.from('client_portal_tokens')
      .update({ is_active: false }).eq('client_id', (req as any).params.clientId).eq('user_id', (req as any).user!.id)
    return res.json({ message: 'Portal deactivated' })
  } catch {
    return res.status(500).json({ error: 'Failed to deactivate portal' })
  }
})

export default router
