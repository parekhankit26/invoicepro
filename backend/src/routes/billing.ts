import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { stripeService } from '../services/stripeService'

const router = Router()
router.use(authenticate)

const FRONTEND = process.env.FRONTEND_URL || 'https://invoicepro-ten.vercel.app'

// Helper: fetch all plans from DB with Stripe price IDs
async function getPlansFromDB() {
  const { data } = await supabase.from('plans').select('slug, name, price_monthly, stripe_price_id, is_active').order('price_monthly')
  return data || []
}

// GET /api/billing/subscription — current subscription + plan config
router.get('/subscription', async (req: AuthRequest, res: Response) => {
  try {
    const [profileResult, plans] = await Promise.all([
      supabase.from('profiles')
        .select('plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end')
        .eq('id', (req as any).user!.id).single(),
      getPlansFromDB()
    ])

    const profile = profileResult.data
    const stripeActive = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder')

    const available_plans: Record<string, any> = {}
    for (const p of plans) {
      if (p.slug === 'free') continue
      available_plans[p.slug] = {
        price: p.price_monthly,
        configured: stripeActive && !!p.stripe_price_id,
        stripe_price_id: p.stripe_price_id || null,
      }
    }

    return res.json({
      plan: profile?.plan || 'free',
      stripe_customer_id: profile?.stripe_customer_id || null,
      stripe_subscription_id: profile?.stripe_subscription_id || null,
      subscription_status: profile?.subscription_status || null,
      subscription_period_end: profile?.subscription_period_end || null,
      stripe_configured: stripeActive && plans.some(p => p.stripe_price_id),
      available_plans,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/subscribe — create Stripe Checkout session
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const { plan } = req.body
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' })
    }
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.status(400).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to Railway.' })
    }

    // Fetch price ID from DB
    const { data: planRow } = await supabase.from('plans').select('stripe_price_id, name').eq('slug', plan).single()
    if (!planRow?.stripe_price_id) {
      return res.status(400).json({ error: `No Stripe price ID set for the ${plan} plan. Set it in the admin panel → Plans.` })
    }

    const { data: profile } = await supabase.from('profiles')
      .select('stripe_customer_id').eq('id', (req as any).user!.id).single()

    const { url } = await stripeService.createSubscriptionCheckout({
      userId: (req as any).user!.id,
      email: (req as any).user!.email,
      plan,
      priceId: planRow.stripe_price_id,
      customerId: profile?.stripe_customer_id || undefined,
      successUrl: `${FRONTEND}/enterprise?upgrade=success&plan=${plan}`,
      cancelUrl:  `${FRONTEND}/enterprise?upgrade=cancelled`,
    })

    return res.json({ url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/portal — Stripe billing portal
router.post('/portal', async (req: AuthRequest, res: Response) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.status(400).json({ error: 'Stripe is not configured.' })
    }
    const { data: profile } = await supabase.from('profiles')
      .select('stripe_customer_id').eq('id', (req as any).user!.id).single()
    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found. Subscribe to a plan first.' })
    }
    const url = await stripeService.createBillingPortal(profile.stripe_customer_id, `${FRONTEND}/enterprise`)
    return res.json({ url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
