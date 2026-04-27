import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export interface AuthRequest extends Request {
  user?: { id: string; email: string }
}

export const authenticate = async (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.headers?.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Missing authorization token' })
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' })
    req.user = { id: user.id, email: user.email! }
    next()
  } catch {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}
