import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'

const router = Router()
router.use(authenticate)

router.get('/summary', async (req: AuthRequest, res: Response) => {
  const { from, to } = (req as any).query
  let query = supabase.from('expenses').select('*').eq('user_id', (req as any).user!.id)
  if (from) query = query.gte('date', from as string)
  if (to) query = query.lte('date', to as string)
  const { data } = await query
  const byCategory: Record<string, number> = {}
  let total = 0
  data?.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; total += e.amount })
  return res.json({ total, by_category: byCategory, count: data?.length || 0 })
})

router.get('/', async (req: AuthRequest, res: Response) => {
  const { category, client_id, from, to, billable } = (req as any).query
  let query = supabase.from('expenses').select(`*, clients(id,name)`).eq('user_id', (req as any).user!.id).order('date', { ascending: false })
  if (category) query = query.eq('category', category)
  if (client_id) query = query.eq('client_id', client_id)
  if (from) query = query.gte('date', from as string)
  if (to) query = query.lte('date', to as string)
  if (billable === 'true') query = query.eq('is_billable', true)
  const { data, error } = await query
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

router.post('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('expenses').insert({ ...(req as any).body, user_id: (req as any).user!.id }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.status(201).json(data)
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase.from('expenses').update((req as any).body).eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await supabase.from('expenses').delete().eq('id', (req as any).params.id).eq('user_id', (req as any).user!.id)
  return res.json({ message: 'Expense deleted' })
})

export default router
