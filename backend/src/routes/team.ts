import { Router, Response, Request } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { emailService } from '../services/emailService'
import crypto from 'crypto'

const router = Router()

// Accept team invite (public)
router.get('/accept/:token', async (req: Request, res: Response) => {
  try {
    const { data: member } = await supabase
      .from('team_members').select('*').eq('invite_token', req.params.token).eq('status', 'pending').single()
    if (!member) return res.status(404).json({ error: 'Invalid or expired invite' })
    return res.json({ member, message: 'Invite valid — please register or login to accept' })
  } catch {
    return res.status(500).json({ error: 'Failed to fetch invite' })
  }
})

router.use(authenticate)

// Get team members
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('team_members').select('*').eq('owner_id', req.user!.id).order('created_at')
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch team' })
  }
})

// Invite team member
router.post('/invite', async (req: AuthRequest, res: Response) => {
  try {
    const { email, full_name, role = 'staff', permissions } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    // Check plan allows team members
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', req.user!.id).single()
    if (!profile || !['pro', 'enterprise'].includes(profile.plan || '')) {
      return res.status(403).json({ error: 'Team members require Pro or Enterprise plan' })
    }

    // Check existing member count
    const { count } = await supabase.from('team_members').select('*', { count: 'exact', head: true })
      .eq('owner_id', req.user!.id).eq('status', 'active')
    const limits: Record<string, number> = { pro: 3, enterprise: -1 }
    const limit = limits[profile.plan || 'free'] || 0
    if (limit !== -1 && (count || 0) >= limit) {
      return res.status(403).json({ error: `Your plan allows max ${limit} team members` })
    }

    // Check not already invited
    const { data: existing } = await supabase.from('team_members')
      .select('id').eq('owner_id', req.user!.id).eq('email', email).single()
    if (existing) return res.status(400).json({ error: 'This email is already a team member' })

    const inviteToken = crypto.randomBytes(32).toString('hex')
    const defaultPermissions = {
      create_invoices: true, send_invoices: role !== 'viewer',
      view_reports: ['admin', 'manager', 'accountant'].includes(role),
      manage_clients: role !== 'viewer', manage_expenses: true, ...permissions
    }

    const { data, error } = await supabase.from('team_members').insert({
      owner_id: req.user!.id, email, full_name, role,
      permissions: defaultPermissions, status: 'pending', invite_token: inviteToken
    }).select().single()
    if (error) return res.status(400).json({ error: error.message })

    const inviteUrl = `${process.env.FRONTEND_URL}/team/accept/${inviteToken}`
    await emailService.sendTeamInvite({ to: email, inviteeName: full_name || email, inviteUrl, role })

    return res.status(201).json({ ...data, invite_url: inviteUrl })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to invite team member' })
  }
})

// Update team member
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['role', 'permissions', 'status', 'full_name']
    const updates: Record<string, any> = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
    const { data, error } = await supabase.from('team_members')
      .update(updates).eq('id', req.params.id).eq('owner_id', req.user!.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to update member' })
  }
})

// Remove team member
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await supabase.from('team_members').delete().eq('id', req.params.id).eq('owner_id', req.user!.id)
    return res.json({ message: 'Team member removed' })
  } catch {
    return res.status(500).json({ error: 'Failed to remove member' })
  }
})

export default router
