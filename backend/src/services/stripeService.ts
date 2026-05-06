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
  async constructWebhookEvent(payload: Buffer, signature: string): Promise<Stripe.Event> {
    return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  }
}
