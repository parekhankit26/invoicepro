import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { stripeService, PLAN_PRICE_IDS, planFromPriceId } from '../services/stripeService'

const router = Router()
router.use(authenticate)

const FRONTEND = process.env.FRONTEND_URL || 'https://invoicepro-ten.vercel.app'

// GET /api/billing/subscription — current subscription info
router.get('/subscription', async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile } = await supabase.from('profiles')
      .select('plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end')
      .eq('id', (req as any).user!.id).single()

    const stripeConfigured = Object.values(PLAN_PRICE_IDS).some(Boolean)

    return res.json({
      plan: profile?.plan || 'free',
      stripe_customer_id: profile?.stripe_customer_id || null,
      stripe_subscription_id: profile?.stripe_subscription_id || null,
      subscription_status: profile?.subscription_status || null,
      subscription_period_end: profile?.subscription_period_end || null,
      stripe_configured: stripeConfigured,
      available_plans: {
        starter:    { price: 9,  configured: !!PLAN_PRICE_IDS.starter },
        pro:        { price: 19, configured: !!PLAN_PRICE_IDS.pro },
        enterprise: { price: 49, configured: !!PLAN_PRICE_IDS.enterprise },
      },
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
    if (!PLAN_PRICE_IDS[plan]) {
      return res.status(400).json({ error: `Stripe price not configured for ${plan}. Add STRIPE_PRICE_${plan.toUpperCase()} to Railway env vars.` })
    }
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.status(400).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to Railway.' })
    }

    const { data: profile } = await supabase.from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, plan')
      .eq('id', (req as any).user!.id).single()

    const userEmail = (req as any).user!.email

    const { url } = await stripeService.createSubscriptionCheckout({
      userId: (req as any).user!.id,
      email: userEmail,
      plan,
      customerId: profile?.stripe_customer_id || undefined,
      successUrl: `${FRONTEND}/enterprise?upgrade=success&plan=${plan}`,
      cancelUrl:  `${FRONTEND}/enterprise?upgrade=cancelled`,
    })

    return res.json({ url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/portal — Stripe billing portal (manage/cancel subscription)
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

    const url = await stripeService.createBillingPortal(
      profile.stripe_customer_id,
      `${FRONTEND}/enterprise`
    )
    return res.json({ url })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
