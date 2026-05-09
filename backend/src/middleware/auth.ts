import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    isTeamMember?: boolean
    teamMemberId?: string
    role?: string
    permissions?: any
  }
}

export const authenticate = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers?.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Missing authorization token' })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' })

    // First check: is this user a registered business OWNER (has their own profile)?
    const { data: ownProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', user.id)
      .single()

    if (ownProfile) {
      // They are a registered owner — check if they are ALSO a team member elsewhere
      // Only proxy if they came via /team/login (checked by looking at team_members for their email
      // BUT only when they don't own their own account data)
      // Decision: if they have their own profile, they are an OWNER — never proxy
      req.user = { id: user.id, email: user.email || '', isTeamMember: false }
      return next()
    }

    // No owner profile — check if they are a team member
    const { data: membership } = await supabase
      .from('team_members')
      .select('id, owner_id, role, permissions, status, email')
      .eq('member_id', user.id)       // match by member_id (set when they accepted invite)
      .eq('status', 'active')
      .single()

    if (membership) {
      req.user = {
        id: membership.owner_id,
        email: user.email || membership.email,
        isTeamMember: true,
        teamMemberId: membership.id,
        role: membership.role,
        permissions: membership.permissions || {},
      }
      return next()
    }

    // Fallback — treat as owner with their own ID
    req.user = { id: user.id, email: user.email || '', isTeamMember: false }
    next()
  } catch {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

export const requirePermission = (permission: string) => {
  return (req: any, res: any, next: any) => {
    if (!req.user?.isTeamMember) return next() // owners always pass
    if (!req.user.permissions?.[permission]) {
      return res.status(403).json({ error: `Permission denied: ${permission}` })
    }
    next()
  }
}
