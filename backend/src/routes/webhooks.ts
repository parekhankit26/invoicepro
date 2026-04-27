import { Router, Request, Response } from 'express'
import { stripeService } from '../services/stripeService'
import { supabase } from '../lib/supabase'
import { emailService } from '../services/emailService'

const router = Router()

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  let event: any
  try { event = await stripeService.constructWebhookEvent((req as any).body, sig) } catch (err: any) { return res.status(400).send(`Webhook Error: ${err.message}`) }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const invoiceId = session.metadata?.invoice_id
    if (invoiceId) {
      const { data: invoice } = await supabase.from('invoices').select(`*, clients(*)`).eq('id', invoiceId).single()
      if (invoice) {
        await supabase.from('invoices').update({ status: 'paid', amount_paid: session.amount_total / 100, paid_at: new Date().toISOString() }).eq('id', invoiceId)
        await supabase.from('payments').insert({ user_id: invoice.user_id, invoice_id: invoiceId, amount: session.amount_total / 100, currency: session.currency.toUpperCase(), method: 'stripe', stripe_payment_id: session.payment_intent, status: 'completed' })
        if (invoice.clients) await emailService.sendPaymentConfirmation({ invoice, client: invoice.clients })
      }
    }
  }
  return res.json({ received: true })
})

export default router
