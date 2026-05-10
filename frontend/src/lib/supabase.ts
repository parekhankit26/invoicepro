import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
  || 'https://bzmyhlkwssyhxkqrjmwj.supabase.co'

const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseAnonKey) {
  console.error('⚠️ VITE_SUPABASE_ANON_KEY is not set. Add it to Vercel environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
