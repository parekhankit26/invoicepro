import Stripe from 'stripe'
import { supabase } from '../lib/supabase'

async function getStripeKey(): Promise<string> {
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'stripe_secret_key').single()
    if (data?.value) return JSON.parse(data.value)
  } catch {}
  return process.env.STRIPE_SECRET_KEY || ''
}

async function getWebhookSecret(): Promise<string> {
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'stripe_webhook_secret').single()
    if (data?.value) return JSON.parse(data.value)
  } catch {}
  return process.env.STRIPE_WEBHOOK_SECRET || ''
}

async function getStripe(): Promise<Stripe> {
  const key = await getStripeKey()
  if (!key || key === 'sk_test_placeholder') {
    throw new Error('Stripe not configured. Add your secret key in Admin → Stripe settings.')
  }
  return new Stripe(key, { apiVersion: '2023-10-16' })
}

export const stripeService = {
  async createPaymentLink(invoice: any): Promise<string> {
    const stripe = await getStripe()
    const product = await stripe.products.create({ name: `Invoice ${invoice.invoice_number}` })
    const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(invoice.total * 100), currency: (invoice.currency || 'GBP').toLowerCase() })
    const paymentLink = await stripe.paymentLinks.create({ line_items: [{ price: price.id, quantity: 1 }], metadata: { invoice_id: invoice.id } })
    return paymentLink.url
  },

  async createSubscriptionCheckout(params: {
    userId: string
    email: string
    plan: string
    priceId: string
    customerId?: string
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string }> {
    const stripe = await getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: params.priceId, quantity: 1 }],
      client_reference_id: params.userId,
      customer_email: params.customerId ? undefined : params.email,
      customer: params.customerId || undefined,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { user_id: params.userId, plan: params.plan },
      subscription_data: { metadata: { user_id: params.userId, plan: params.plan } },
    })
    return { url: session.url! }
  },

  async createBillingPortal(customerId: string, returnUrl: string): Promise<string> {
    const stripe = await getStripe()
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
    return session.url
  },

  async constructWebhookEvent(payload: Buffer, signature: string): Promise<Stripe.Event> {
    const key = await getStripeKey()
    const secret = await getWebhookSecret()
    if (!key || !secret) throw new Error('Stripe not configured')
    const stripe = new Stripe(key, { apiVersion: '2023-10-16' })
    return stripe.webhooks.constructEvent(payload, signature, secret)
  },

  async testConnection(): Promise<{ valid: boolean; account?: string; mode?: string; error?: string }> {
    try {
      const stripe = await getStripe()
      const key = await getStripeKey()
      // balance.retrieve() works for any valid key — no ID required
      await stripe.balance.retrieve()
      return {
        valid: true,
        account: key.startsWith('sk_test_') ? 'Test mode account' : 'Live account',
        mode: key.startsWith('sk_test_') ? 'test' : 'live',
      }
    } catch (err: any) {
      return { valid: false, error: err.message }
    }
  }
}
