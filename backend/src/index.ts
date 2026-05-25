import express from 'express'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import cron from 'node-cron'
import rateLimit from 'express-rate-limit'

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
import adminRoutes from './routes/admin'
import billingRoutes from './routes/billing'
import { reminderService } from './services/reminderService'
import { recurringService } from './services/recurringService'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 3001

// Allowed frontend origins — add your Vercel preview URLs or custom domain if needed
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'https://invoicepro-ten.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  // Backend's own origin — needed so the admin panel (served from Railway) can call /api/* routes
  'https://invoicepro-production-2ed7.up.railway.app',
  process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '',
].filter(Boolean)

// Trust Railway proxy (needed for correct IP behind load balancer)
app.set('trust proxy', 1)

// Security headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // needed for PDF/logo serving
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],   // needed for admin panel inline scripts
      scriptSrcAttr: ["'unsafe-inline'"],         // needed for admin panel onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.anthropic.com', 'https://api.stripe.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    }
  }
}))

// CORS — only allow the actual frontend, not every origin on the internet
app.use(cors({
  origin: (origin: any, cb: any) => {
    // Allow requests with no origin (mobile apps, curl, Stripe webhooks)
    if (!origin) return cb(null, true)
    // Allow whitelisted origins
    if (ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith('.vercel.app'))) {
      return cb(null, true)
    }
    return cb(new Error(`CORS: origin ${origin} not allowed`), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length']
}))

// ── Rate limiting ─────────────────────────────────────────
// Strict limit on auth endpoints to prevent brute force
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
  skip: (req) => process.env.NODE_ENV === 'development',
})

// General API limit — generous but still blocks abuse
const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 300,             // 300 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => process.env.NODE_ENV === 'development',
})

// Apply rate limits
app.use('/api/auth/login', authRateLimit)
app.use('/api/auth/register', authRateLimit)
app.use('/api/auth/forgot-password', authRateLimit)
app.use('/api/auth/reset-user-password', authRateLimit)
app.use('/api/admin/login', authRateLimit)
app.use('/api', generalRateLimit)

// Stripe webhooks need raw body — must be before express.json()
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes)

// Body parsers — 1MB default, receipt scanner gets 10MB on its specific route
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))


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
app.use('/api/admin', adminRoutes)
app.use('/api/billing', billingRoutes)

// Serve admin panel HTML at /admin
const adminPanelPath = path.join(__dirname, 'admin-panel')
app.use('/admin', express.static(adminPanelPath))
app.get('/admin', (_req, res) => res.sendFile(path.join(adminPanelPath, 'index.html')))
app.get('/admin/*', (_req, res) => res.sendFile(path.join(adminPanelPath, 'index.html')))

app.get('/health', (_, res) => res.json({ status: 'ok', version: '2.0.0', features: ['ai-assistant','whatsapp-sms','receipt-scanner','cashflow','financing','milestones','early-payment','happiness-score','year-review'], timestamp: new Date().toISOString() }))

// Global error handler — ensures API routes always return JSON, never HTML
app.use((err: any, req: any, res: any, next: any) => {
  if (req.path.startsWith('/api/')) {
    const status = err.status || err.statusCode || 500
    return res.status(status).json({ error: err.message || 'Internal server error' })
  }
  next(err)
})

cron.schedule('0 9 * * *', async () => { await reminderService.sendOverdueReminders(); await reminderService.sendUpcomingDueReminders() })
cron.schedule('0 0 * * *', async () => { const { supabase } = await import('./lib/supabase'); await supabase.from('invoices').update({ status: 'overdue' }).in('status', ['sent','pending']).lt('due_date', new Date().toISOString().split('T')[0]) })

app.listen(PORT, () => { console.log('🚀 InvoicePro v2.0 running on port ' + PORT) })
export default app
