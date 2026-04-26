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
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
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

app.get('/health', (_, res) => res.json({ status: 'ok', version: '2.0.0', features: ['ai-assistant','whatsapp-sms','receipt-scanner','cashflow','financing','milestones','early-payment','happiness-score','year-review'], timestamp: new Date().toISOString() }))

cron.schedule('0 9 * * *', async () => { await reminderService.sendOverdueReminders(); await reminderService.sendUpcomingDueReminders() })
cron.schedule('0 8 * * *', async () => { await recurringService.generateDueInvoices() })
cron.schedule('0 0 * * *', async () => { const { supabase } = await import('./lib/supabase'); await supabase.from('invoices').update({ status: 'overdue' }).in('status', ['sent','pending']).lt('due_date', new Date().toISOString().split('T')[0]) })

app.listen(PORT, () => { console.log('🚀 InvoicePro v2.0 running on port ' + PORT) })
export default app
