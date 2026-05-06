import { Router, Response, Request } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { emailService } from '../services/emailService'
import crypto from 'crypto'

const router = Router()

// ── PUBLIC: Get invite details ───────────────────────────
router.get('/accept/:token', async (req: Request, res: Response) => {
  try {
    const { data: member } = await supabase
      .from('team_members').select('*, profiles!owner_id(company_name, full_name)')
      .eq('invite_token', (req as any).params.token).eq('status', 'pending').single()
    if (!member) return res.status(404).json({ error: 'Invalid or expired invite link' })
    return res.json({ member, owner_company: (member as any).profiles?.company_name || (member as any).profiles?.full_name })
  } catch {
    return res.status(500).json({ error: 'Failed to fetch invite' })
  }
})

// ── PUBLIC: Accept invite — create account + activate ────
router.post('/accept/:token', async (req: Request, res: Response) => {
  try {
    const { password, full_name } = (req as any).body
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const { data: member } = await supabase
      .from('team_members').select('*').eq('invite_token', (req as any).params.token).eq('status', 'pending').single()
    if (!member) return res.status(404).json({ error: 'Invalid or expired invite' })

    // Create Supabase auth user for team member
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: member.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || member.full_name, team_member: true, owner_id: member.owner_id }
    })
    if (authError) {
      // User might already exist — try to get them
      const { data: existing } = await supabase.from('profiles').select('id').eq('email', member.email).single()
      if (!existing) return res.status(400).json({ error: authError.message })
    }

    const memberId = authUser?.user?.id
    // Activate team member record
    await supabase.from('team_members').update({
      status: 'active',
      member_id: memberId || null,
      full_name: full_name || member.full_name,
      joined_at: new Date().toISOString(),
      invite_token: null
    }).eq('id', member.id)

    return res.json({ message: 'Account created! You can now log in.', email: member.email })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to accept invite' })
  }
})

// ── PUBLIC: Team member login ────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = (req as any).body
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return res.status(401).json({ error: 'Invalid credentials' })

    // Check they are an active team member
    const { data: membership } = await supabase
      .from('team_members').select('*, profiles!owner_id(*)').eq('email', email).eq('status', 'active').single()
    if (!membership) return res.status(403).json({ error: 'No active team membership found for this email' })

    return res.json({
      token: data.session?.access_token,
      user: data.user,
      membership: {
        id: membership.id,
        role: membership.role,
        permissions: membership.permissions,
        owner_id: membership.owner_id,
        owner_profile: (membership as any).profiles
      },
      is_team_member: true
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ── PROTECTED ────────────────────────────────────────────
router.use(authenticate)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('team_members').select('*').eq('owner_id', (req as any).user!.id).order('created_at')
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch team' })
  }
})

// Get my membership (for team members to check their own access)
router.get('/my-membership', async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', (req as any).user!.id).single()
    const { data: membership } = await supabase
      .from('team_members').select('*, profiles!owner_id(*)').eq('email', profile?.email || '').eq('status', 'active').single()
    if (!membership) return res.status(404).json({ error: 'Not a team member' })
    return res.json({ membership, owner_profile: (membership as any).profiles })
  } catch {
    return res.status(404).json({ error: 'Not a team member' })
  }
})

router.post('/invite', async (req: AuthRequest, res: Response) => {
  try {
    const { email, full_name, role = 'staff', permissions } = (req as any).body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const { data: profile } = await supabase.from('profiles').select('plan, company_name, full_name').eq('id', (req as any).user!.id).single()
    if (!profile || !['pro', 'enterprise'].includes(profile.plan || '')) {
      return res.status(403).json({ error: 'Team members require Pro or Enterprise plan' })
    }

    const { count } = await supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('owner_id', (req as any).user!.id).eq('status', 'active')
    const limits: Record<string, number> = { pro: 3, enterprise: -1 }
    const limit = limits[profile.plan || 'free'] || 0
    if (limit !== -1 && (count || 0) >= limit) {
      return res.status(403).json({ error: `Your plan allows max ${limit} team members` })
    }

    const { data: existing } = await supabase.from('team_members').select('id, status').eq('owner_id', (req as any).user!.id).eq('email', email).single()
    if (existing) return res.status(400).json({ error: 'This email is already a team member' })

    const inviteToken = crypto.randomBytes(32).toString('hex')
    const defaultPermissions = {
      create_invoices: true,
      send_invoices: role !== 'viewer',
      view_reports: ['admin', 'manager', 'accountant'].includes(role),
      manage_clients: role !== 'viewer',
      manage_expenses: true,
      ...permissions
    }

    const { data, error } = await supabase.from('team_members').insert({
      owner_id: (req as any).user!.id, email, full_name, role,
      permissions: defaultPermissions, status: 'pending', invite_token: inviteToken
    }).select().single()
    if (error) return res.status(400).json({ error: error.message })

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/team/accept/${inviteToken}`
    const companyName = profile.company_name || profile.full_name || 'Your employer'
    try {
      await emailService.sendTeamInvite({ to: email, inviteeName: full_name || email, inviteUrl, role })
    } catch(e) { console.log('Invite email failed:', e) }

    return res.status(201).json({ ...data, invite_url: inviteUrl, message: `Invite sent to ${email}` })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const allowed = ['role', 'permissions', 'status', 'full_name']
    const updates: Record<string, any> = {}
    allowed.forEach(k => { if ((req as any).body[k] !== undefined) updates[k] = (req as any).body[k] })
    const { data, error } = await supabase.from('team_members').update(updates).eq('id', (req as any).params.id).eq('owner_id', (req as any).user!.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Failed to update member' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await supabase.from('team_members').delete().eq('id', (req as any).params.id).eq('owner_id', (req as any).user!.id)
    return res.json({ message: 'Team member removed' })
  } catch {
    return res.status(500).json({ error: 'Failed to remove member' })
  }
})

export default router
