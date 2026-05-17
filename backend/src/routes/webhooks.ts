import { Router, Request, Response } from 'express'
import { stripeService, planFromPriceId } from '../services/stripeService'
import { supabase } from '../lib/supabase'
import { emailService } from '../services/emailService'

const router = Router()

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  let event: any
  try {
    event = await stripeService.constructWebhookEvent((req as any).body, sig)
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const obj = event.data.object

  // ── ONE-TIME INVOICE PAYMENT ──────────────────────────────
  if (event.type === 'checkout.session.completed' && obj.mode === 'payment') {
    const invoiceId = obj.metadata?.invoice_id
    if (invoiceId) {
      const { data: invoice } = await supabase.from('invoices').select(`*, clients(*)`).eq('id', invoiceId).single()
      if (invoice) {
        await supabase.from('invoices').update({ status: 'paid', amount_paid: obj.amount_total / 100, paid_at: new Date().toISOString() }).eq('id', invoiceId)
        await supabase.from('payments').insert({ user_id: invoice.user_id, invoice_id: invoiceId, amount: obj.amount_total / 100, currency: obj.currency.toUpperCase(), method: 'stripe', stripe_payment_id: obj.payment_intent, status: 'completed' })
        if (invoice.clients) await emailService.sendPaymentConfirmation({ invoice, client: invoice.clients })
      }
    }
  }

  // ── SUBSCRIPTION CHECKOUT COMPLETED ──────────────────────
  if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') {
    const userId = obj.client_reference_id || obj.metadata?.user_id
    const customerId = obj.customer
    const subscriptionId = obj.subscription
    const plan = obj.metadata?.plan

    if (userId) {
      await supabase.from('profiles').update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: 'active',
        plan: plan || 'starter',
      }).eq('id', userId)
    }
  }

  // ── SUBSCRIPTION UPDATED (plan change, renewal, etc.) ────
  if (event.type === 'customer.subscription.updated') {
    const customerId = obj.customer
    const subscriptionId = obj.id
    const status = obj.status // active | past_due | canceled | trialing etc.
    const periodEnd = new Date(obj.current_period_end * 1000).toISOString()

    // Determine plan from price ID
    const priceId = obj.items?.data?.[0]?.price?.id
    const plan = priceId ? planFromPriceId(priceId) : null

    const updates: Record<string, any> = {
      stripe_subscription_id: subscriptionId,
      subscription_status: status,
      subscription_period_end: periodEnd,
    }
    if (plan) updates.plan = plan

    // Find user by customer ID
    const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).single()
    if (profile) await supabase.from('profiles').update(updates).eq('id', profile.id)
  }

  // ── SUBSCRIPTION CANCELLED ───────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const customerId = obj.customer
    const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).single()
    if (profile) {
      await supabase.from('profiles').update({
        plan: 'free',
        stripe_subscription_id: null,
        subscription_status: 'cancelled',
        subscription_period_end: null,
      }).eq('id', profile.id)
    }
  }

  return res.json({ received: true })
})

export default router
