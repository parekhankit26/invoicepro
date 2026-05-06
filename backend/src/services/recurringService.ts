import { supabase } from '../lib/supabase'

export const recurringService = {
  async generateDueInvoices() {
    const today = new Date().toISOString().split('T')[0]
    const { data: templates } = await supabase.from('invoices').select(`*, invoice_items(*)`).eq('is_recurring', true).lte('next_invoice_date', today).not('next_invoice_date', 'is', null)
    for (const t of templates || []) {
      if (t.recurring_end_date && today > t.recurring_end_date) { await supabase.from('invoices').update({ is_recurring: false }).eq('id', t.id); continue }
      const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', t.user_id)
      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30)
      const { data: inv } = await supabase.from('invoices').insert({ user_id: t.user_id, client_id: t.client_id, invoice_number: `INV-${String((count||0)+1).padStart(4,'0')}`, status: 'draft', issue_date: new Date().toISOString().split('T')[0], due_date: dueDate.toISOString().split('T')[0], currency: t.currency, subtotal: t.subtotal, tax_rate: t.tax_rate, tax_amount: t.tax_amount, discount_percent: t.discount_percent, discount_amount: t.discount_amount, total: t.total, notes: t.notes, terms: t.terms, recurring_parent_id: t.id }).select().single()
      if (inv) await supabase.from('invoice_items').insert(t.invoice_items.map((item: any) => ({ invoice_id: inv.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, tax_rate: item.tax_rate, amount: item.amount, sort_order: item.sort_order })))
      const d = new Date(t.next_invoice_date)
      if (t.recurring_interval === 'weekly') d.setDate(d.getDate() + 7)
      else if (t.recurring_interval === 'monthly') d.setMonth(d.getMonth() + 1)
      else if (t.recurring_interval === 'quarterly') d.setMonth(d.getMonth() + 3)
      else if (t.recurring_interval === 'yearly') d.setFullYear(d.getFullYear() + 1)
      await supabase.from('invoices').update({ next_invoice_date: d.toISOString().split('T')[0] }).eq('id', t.id)
    }
  }
}
