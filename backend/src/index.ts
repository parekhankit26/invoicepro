import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import cron from 'node-cron'

import authRoutes from './routes/auth'
import invoiceRoutes from './routes/invoices'
import clientRoutes from './routes/clients'
import paymentRoutes from './routes/payments'
import expenseRoutes from './routes/expenses'
import dashboardRoutes from './routes/dashboard'
import webhookRoutes from './routes/webhooks'
import quoteRoutes from './routes/quotes'
import timeRoutes from './routes/timeTracking'
import portalRoutes from './routes/portal'
import teamRoutes from './routes/team'
import enterpriseRoutes from './routes/enterprise'
import aiAssistantRoutes from './routes/aiAssistant'
import notificationsRoutes from './routes/notifications'
import featuresRoutes from './routes/features'
import { reminderService } from './services/reminderService'
import { recurringService } from './services/recurringService'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'https://invoicepro-production-2ed7.up.railway.app',
      'capacitor://localhost',
      'ionic://localhost',
      'http://localhost',
    ]
    // Allow mobile apps (Capacitor sends no origin) and allowed origins
    if (!origin || allowed.includes(origin)) return callback(null, true)
    return callback(null, true) // allow all for mobile compatibility
  },
  credentials: true
}))
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))

app.use('/api/auth', authRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/clients', clientRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/quotes', quoteRoutes)
app.use('/api/time', timeRoutes)
app.use('/api/portal', portalRoutes)
app.use('/api/team', teamRoutes)
app.use('/api/enterprise', enterpriseRoutes)
app.use('/api/ai', aiAssistantRoutes)
app.use('/api/notify', notificationsRoutes)
app.use('/api/features', featuresRoutes)

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.get('/privacy', (_, res) => {
  res.setHeader('Content-Type', 'text/html')
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy – InvoicePro</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 40px 24px 80px; color: #1a1814; line-height: 1.7; background: #f8f7f4; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 17px; font-weight: 600; margin-top: 32px; margin-bottom: 8px; }
  p, li { font-size: 15px; color: #3a3530; }
  ul { padding-left: 20px; }
  .updated { font-size: 13px; color: #93897a; margin-bottom: 40px; }
  a { color: #1a1814; }
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p class="updated">Last updated: June 2025</p>

<p>InvoicePro ("we", "our", or "us") is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights.</p>

<h2>1. Information We Collect</h2>
<ul>
  <li><strong>Account information:</strong> name, email address, and password when you register.</li>
  <li><strong>Business data:</strong> invoices, clients, expenses, and quotes you create within the app.</li>
  <li><strong>Usage data:</strong> basic analytics such as feature usage and error logs to improve the app.</li>
  <li><strong>Device information:</strong> device type and OS version for compatibility purposes.</li>
</ul>

<h2>2. How We Use Your Information</h2>
<ul>
  <li>To provide and operate the InvoicePro service.</li>
  <li>To send invoice reminders and notifications you configure.</li>
  <li>To process payments via Stripe (we never store card details — Stripe handles this).</li>
  <li>To improve and fix issues in the app.</li>
</ul>

<h2>3. Data Storage</h2>
<p>Your data is stored securely using Supabase (PostgreSQL). All data is encrypted in transit (HTTPS/TLS) and at rest.</p>

<h2>4. Data Sharing</h2>
<p>We do not sell your data. We only share data with:</p>
<ul>
  <li><strong>Supabase</strong> – database hosting</li>
  <li><strong>Stripe</strong> – payment processing</li>
  <li><strong>Railway</strong> – server hosting</li>
</ul>
<p>All third-party providers are GDPR-compliant.</p>

<h2>5. Your Rights</h2>
<p>You can request deletion of your account and all associated data at any time by emailing us. Upon deletion, all your data is permanently removed within 30 days.</p>

<h2>6. Children's Privacy</h2>
<p>InvoicePro is not intended for users under 13 years of age. We do not knowingly collect data from children.</p>

<h2>7. Changes to This Policy</h2>
<p>We may update this policy. We will notify you of significant changes via email or an in-app notice.</p>

<h2>8. Contact Us</h2>
<p>If you have any questions about this Privacy Policy, contact us at:<br>
<a href="mailto:parekhankit3@gmail.com">parekhankit3@gmail.com</a></p>
</body>
</html>`)
})

cron.schedule('0 9 * * *', async () => { await reminderService.sendOverdueReminders(); await reminderService.sendUpcomingDueReminders() })
cron.schedule('0 8 * * *', async () => { await recurringService.generateDueInvoices() })
cron.schedule('0 0 * * *', async () => { const { supabase } = await import('./lib/supabase'); await supabase.from('invoices').update({ status: 'overdue' }).in('status', ['sent','pending']).lt('due_date', new Date().toISOString().split('T')[0]) })

app.listen(PORT, () => { console.log('🚀 InvoicePro v2.0 running on port ' + PORT) })
export default app
