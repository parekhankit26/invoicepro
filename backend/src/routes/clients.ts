import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'

const router = Router()
router.use(authenticate)

router.get('/', async (req: AuthRequest, res: Response) => {
  const { search, archived } = req.query
  let query = supabase.from('clients').select('*').eq('user_id', req.user!.id).order('name')
  if (search) query = query.ilike('name', `%${search}%`)
  if (archived !== 'true') query = query.eq('is_archived', false)
  const { data, error } = await query
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data: client } = await supabase.from('clients').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (!client) return res.status(404).json({ error: 'Client not found' })
  const { data: invoices } = await supabase.from('invoices').select('*').eq('client_id', req.params.id).order('created_at', { ascending: false })
  const stats = {
    total_billed: invoices?.reduce((s, i) => s + i.total, 0) || 0,
    total_paid: invoices?.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0) || 0,
    outstanding: invoices?.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0) || 0,
    invoice_count: invoices?.length || 0
  }
  return res.json({ ...client, invoices, stats })
})

router.post('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('clients').insert({ ...req.body, user_id: req.user!.id }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.status(201).json(data)
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('clients').update(req.body).eq('id', req.params.id).eq('user_id', req.user!.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await supabase.from('clients').update({ is_archived: true }).eq('id', req.params.id).eq('user_id', req.user!.id)
  return res.json({ message: 'Client archived' })
})

export default router
