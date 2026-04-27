import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'

const router = Router()
router.use(authenticate)

// AI Assistant — understands natural language and performs actions
router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { message, conversation_history = [] } = (req as any).body
    const userId = (req as any).user!.id

    // Fetch user's data for context
    const [invoicesRes, clientsRes, expensesRes, profileRes] = await Promise.all([
      supabase.from('invoices').select('*, clients(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('clients').select('*').eq('user_id', userId).eq('is_archived', false),
      supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(20),
      supabase.from('profiles').select('*').eq('id', userId).single()
    ])

    const invoices = invoicesRes.data || []
    const clients = clientsRes.data || []
    const expenses = expensesRes.data || []
    const profile = profileRes.data

    const totalBilled = invoices.reduce((s, i) => s + i.total, 0)
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
    const overdue = invoices.filter(i => i.status === 'overdue' || (i.status !== 'paid' && new Date(i.due_date) < new Date()))
    const totalOverdue = overdue.reduce((s, i) => s + i.total, 0)
    const currency = profile?.default_currency || 'GBP'
    const currencySymbol: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'C$', AUD: 'A$' }
    const sym = currencySymbol[currency] || currency

    const systemPrompt = `You are an intelligent invoice assistant for InvoicePro. You help the user manage their invoices, clients, and finances through natural conversation.

USER'S BUSINESS DATA:
- Name: ${profile?.full_name || 'User'}, Company: ${profile?.company_name || 'Not set'}
- Currency: ${currency} (${sym})
- Total invoices: ${invoices.length}
- Total billed: ${sym}${totalBilled.toFixed(2)}
- Total paid: ${sym}${totalPaid.toFixed(2)}
- Overdue: ${sym}${totalOverdue.toFixed(2)} (${overdue.length} invoices)
- Active clients: ${clients.length}

RECENT INVOICES (last 10):
${invoices.slice(0, 10).map(i => `- ${i.invoice_number}: ${i.clients?.name || 'No client'} | ${sym}${i.total.toFixed(2)} | ${i.status} | due ${i.due_date}`).join('\n')}

CLIENTS:
${clients.map(c => `- ${c.name} (${c.email})`).join('\n')}

INSTRUCTIONS:
1. Answer questions about their finances, invoices, clients naturally and helpfully
2. When they want to CREATE an invoice, respond with a JSON action block like:
   <action>{"type":"create_invoice","client_name":"X","amount":1000,"description":"Y","due_days":30}</action>
3. When they want to SEND a reminder, respond with:
   <action>{"type":"send_reminder","invoice_ids":["id1","id2"]}</action>
4. When they want a REPORT, provide the data from the context above
5. For cash flow questions, calculate based on upcoming due dates
6. Be concise, friendly, and always in the user's currency (${currency})
7. If asked who hasn't paid, list overdue clients clearly
8. Never make up data — only use what's provided above`

    const messages = [
      ...conversation_history.slice(-10),
      { role: 'user', content: message }
    ]

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages
      })
    })

    const data = await response.json() as any
    const aiMessage = data.content?.[0]?.text || 'Sorry, I could not process that request.'

    // Check for action blocks
    const actionMatch = aiMessage.match(/<action>(.*?)<\/action>/s)
    let action: any = null
    let cleanMessage = aiMessage.replace(/<action>.*?<\/action>/s, '').trim()

    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1])

        // Execute the action
        if (action.type === 'create_invoice') {
          const client = clients.find(c => c.name.toLowerCase().includes(action.client_name?.toLowerCase()))
          if (client) {
            const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', userId)
            const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + (action.due_days || 30))
            const subtotal = action.amount || 0
            const taxRate = profile?.default_tax_rate || 20
            const taxAmount = subtotal * (taxRate / 100)
            const total = subtotal + taxAmount

            const { data: invoice } = await supabase.from('invoices').insert({
              user_id: userId, client_id: client.id, invoice_number: invoiceNumber,
              status: 'draft', issue_date: new Date().toISOString().split('T')[0],
              due_date: dueDate.toISOString().split('T')[0], currency,
              subtotal, tax_rate: taxRate, tax_amount: taxAmount, discount_percent: 0, discount_amount: 0, total,
              notes: action.description || ''
            }).select().single()

            if (invoice && action.description) {
              await supabase.from('invoice_items').insert({
                invoice_id: invoice.id, description: action.description,
                quantity: 1, unit_price: subtotal, tax_rate: 0, amount: subtotal, sort_order: 0
              })
            }

            action.result = { invoice_id: invoice?.id, invoice_number: invoiceNumber }
            cleanMessage += `\n\n✓ Invoice ${invoiceNumber} created for ${client.name} — ${sym}${total.toFixed(2)}`
          } else {
            cleanMessage += `\n\nI couldn't find a client matching "${action.client_name}". Please add them to your clients first.`
          }
        }
      } catch (e) {
        console.error('Action parse error:', e)
      }
    }

    return res.json({
      message: cleanMessage,
      action,
      context: { total_billed: totalBilled, total_paid: totalPaid, total_overdue: totalOverdue, overdue_count: overdue.length }
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'AI assistant failed' })
  }
})

// Get conversation suggestions
router.get('/suggestions', async (req: AuthRequest, res: Response) => {
  const { data: overdue } = await supabase.from('invoices').select('invoice_number').eq('user_id', (req as any).user!.id).eq('status', 'overdue').limit(3)
  const suggestions = [
    'Who hasn\'t paid me this month?',
    'What\'s my total revenue this year?',
    'Create an invoice for £500 for consulting',
    'How much VAT do I owe?',
    'Show me my cash flow for next 30 days',
    'Which client is my biggest this year?',
  ]
  if (overdue && overdue.length > 0) suggestions.unshift(`Send reminders for all overdue invoices`)
  return res.json(suggestions.slice(0, 6))
})

export default router
