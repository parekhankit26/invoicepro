import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { stripeService } from '../services/stripeService'

const router = Router()
router.use(authenticate)

const FRONTEND = process.env.FRONTEND_URL || 'https://invoicepro-ten.vercel.app'

// Currency → country code mapping (covers most common countries)
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  IN: 'INR', PK: 'INR', BD: 'INR', LK: 'INR', NP: 'INR',
  US: 'USD', CA: 'USD', MX: 'USD', AU: 'USD', NZ: 'USD', SG: 'USD', HK: 'USD',
  AE: 'USD', SA: 'USD', QA: 'USD', KW: 'USD', BH: 'USD', OM: 'USD',
  GB: 'GBP', IE: 'GBP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
  PT: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', SE: 'EUR', NO: 'EUR',
  DK: 'EUR', PL: 'EUR', CZ: 'EUR', RO: 'EUR', HU: 'EUR', CH: 'EUR',
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£', USD: '$', EUR: '€', INR: '₹',
}

async function getPlansFromDB() {
  const { data } = await supabase.from('plans')
    .select('id, slug, name, price_monthly, price_yearly, stripe_price_id, stripe_price_id_yearly, is_active')
    .order('price_monthly')
  return data || []
}

async function getRegionalPricing(planId: string, currency: string) {
  const { data } = await supabase.from('plan_regional_pricing')
    .select('*')
    .eq('plan_id', planId)
    .eq('currency_code', currency)
    .eq('is_active', true)
    .maybeSingle()
  return data || null
}

// GET /api/billing/subscription — current subscription + plan config
router.get('/subscription', async (req: AuthRequest, res: Response) => {
  try {
    const currency = (req.query.currency as string || 'GBP').toUpperCase()
    const stripeActive = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder')

    const [profileResult, plans] = await Promise.all([
      supabase.from('profiles')
        .select('plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end')
        .eq('id', (req as any).user!.id).single(),
      getPlansFromDB()
    ])

    const profile = profileResult.data

    const available_plans: Record<string, any> = {}
    for (const p of plans) {
      if (p.slug === 'free') continue

      // Check for regional pricing
      const regional = currency !== 'GBP' ? await getRegionalPricing(p.id, currency) : null

      const priceMonthly = regional?.price_monthly ?? p.price_monthly
      const priceYearly = regional?.price_yearly ?? p.price_yearly
      const priceIdMonthly = regional?.stripe_price_id ?? p.stripe_price_id
      const priceIdYearly = regional?.stripe_price_id_yearly ?? p.stripe_price_id_yearly

      available_plans[p.slug] = {
        price_monthly: priceMonthly,
        price_yearly: priceYearly,
        yearly_saving: priceMonthly && priceYearly
          ? Math.round((1 - priceYearly / (priceMonthly * 12)) * 100)
          : 0,
        monthly_configured: stripeActive && !!priceIdMonthly,
        yearly_configured: stripeActive && !!priceIdYearly,
        stripe_price_id: priceIdMonthly || null,
        stripe_price_id_yearly: priceIdYearly || null,
        currency,
        currency_symbol: CURRENCY_SYMBOLS[currency] || '£',
        has_regional: !!regional,
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
      currency,
      currency_symbol: CURRENCY_SYMBOLS[currency] || '£',
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/billing/subscribe — create Stripe Checkout session
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const { plan, billing_period = 'monthly', currency = 'GBP' } = req.body
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' })
    }
    if (!['monthly', 'yearly'].includes(billing_period)) {
      return res.status(400).json({ error: 'billing_period must be monthly or yearly' })
    }

    const { data: planRow } = await supabase.from('plans')
      .select('id, stripe_price_id, stripe_price_id_yearly, name')
      .eq('slug', plan).single()

    // Check regional pricing first
    let priceId: string | null = null
    const normalizedCurrency = (currency as string).toUpperCase()
    if (normalizedCurrency !== 'GBP' && planRow?.id) {
      const regional = await getRegionalPricing(planRow.id, normalizedCurrency)
      if (regional) {
        priceId = billing_period === 'yearly' ? regional.stripe_price_id_yearly : regional.stripe_price_id
      }
    }

    // Fall back to default (GBP) pricing
    if (!priceId) {
      priceId = billing_period === 'yearly' ? planRow?.stripe_price_id_yearly : planRow?.stripe_price_id
    }

    if (!priceId) {
      const period = billing_period === 'yearly' ? 'yearly' : 'monthly'
      return res.status(400).json({ error: `No Stripe ${period} price ID set for the ${plan} plan. Add it in admin panel → Plans.` })
    }

    const { data: profile } = await supabase.from('profiles')
      .select('stripe_customer_id').eq('id', (req as any).user!.id).single()

    const { url } = await stripeService.createSubscriptionCheckout({
      userId: (req as any).user!.id,
      email: (req as any).user!.email,
      plan,
      priceId,
      customerId: profile?.stripe_customer_id || undefined,
      successUrl: `${FRONTEND}/enterprise?upgrade=success&plan=${plan}&period=${billing_period}`,
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
