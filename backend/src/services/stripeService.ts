import Stripe from 'stripe'
import dotenv from 'dotenv'
dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', { apiVersion: '2023-10-16' })

export const stripeService = {
  async createPaymentLink(invoice: any): Promise<string> {
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
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
    return session.url
  },

  async constructWebhookEvent(payload: Buffer, signature: string): Promise<Stripe.Event> {
    return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  }
}
