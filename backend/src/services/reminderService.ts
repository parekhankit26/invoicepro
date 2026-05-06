import { supabase } from '../lib/supabase'
import { emailService } from './emailService'

export const reminderService = {
  async sendOverdueReminders() {
    const now = new Date()
    const { data: overdue } = await supabase.from('invoices').select(`*, clients(*)`).in('status', ['sent','pending']).lt('due_date', now.toISOString().split('T')[0])
    for (const invoice of overdue || []) {
      if (!invoice.clients?.email) continue
      const daysOverdue = Math.floor((now.getTime() - new Date(invoice.due_date).getTime()) / 86400000)
      if (![1,7,14,30].includes(daysOverdue)) continue
      const { data: recent } = await supabase.from('reminder_logs').select('id').eq('invoice_id', invoice.id).eq('type', 'overdue').gte('sent_at', new Date(Date.now() - 86400000).toISOString()).single()
      if (recent) continue
      try {
        await emailService.sendOverdueReminder({ invoice, client: invoice.clients, daysOverdue })
        await supabase.from('reminder_logs').insert({ invoice_id: invoice.id, type: 'overdue', email_to: invoice.clients.email, success: true })
        await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id)
      } catch {}
    }
  },
  async sendUpcomingDueReminders() {
    const in7 = new Date(); in7.setDate(in7.getDate() + 7)
    const { data: upcoming } = await supabase.from('invoices').select(`*, clients(*)`).in('status', ['sent','pending']).gte('due_date', new Date().toISOString().split('T')[0]).lte('due_date', in7.toISOString().split('T')[0])
    for (const invoice of upcoming || []) {
      if (!invoice.clients?.email) continue
      const daysUntilDue = Math.ceil((new Date(invoice.due_date).getTime() - Date.now()) / 86400000)
      if (![1,3,7].includes(daysUntilDue)) continue
      try {
        await emailService.sendUpcomingReminder({ invoice, client: invoice.clients, daysUntilDue })
        await supabase.from('reminder_logs').insert({ invoice_id: invoice.id, type: 'upcoming', email_to: invoice.clients.email, success: true })
      } catch {}
    }
  }
}
