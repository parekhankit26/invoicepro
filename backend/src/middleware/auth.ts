import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export interface AuthRequest extends Request {
  user?: { id: string; email: string; isTeamMember?: boolean; teamMemberId?: string; role?: string; permissions?: any }
}

export const authenticate = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers?.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Missing authorization token' })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' })

    // Check if this user is a team member — if so, proxy all requests to owner's data
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single()
    const { data: membership } = await supabase
      .from('team_members')
      .select('id, owner_id, role, permissions, status')
      .eq('email', profile?.email || user.email || '')
      .eq('status', 'active')
      .single()

    if (membership) {
      // Team member: use OWNER's ID for all data queries
      req.user = {
        id: membership.owner_id,          // ← owner's data
        email: user.email,
        isTeamMember: true,
        teamMemberId: membership.id,
        role: membership.role,
        permissions: membership.permissions || {}
      }
    } else {
      // Regular business owner
      req.user = { id: user.id, email: user.email, isTeamMember: false }
    }

    next()
  } catch {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

// Middleware to check specific team permissions
export const requirePermission = (permission: string) => {
  return (req: any, res: any, next: any) => {
    if (!req.user?.isTeamMember) return next() // owners have all permissions
    if (!req.user.permissions?.[permission]) {
      return res.status(403).json({ error: `You do not have permission: ${permission}` })
    }
    next()
  }
}
