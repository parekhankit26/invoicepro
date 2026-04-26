import { create } from 'zustand'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
interface AuthState { user: User | null; loading: boolean; setUser: (u: User | null) => void; signIn: (email: string, password: string) => Promise<void>; signUp: (email: string, password: string, fullName: string, companyName?: string) => Promise<void>; signOut: () => Promise<void> }
export const useAuthStore = create<AuthState>((set) => ({
  user: null, loading: true,
  setUser: (user) => set({ user, loading: false }),
  signIn: async (email, password) => { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error },
  signUp: async (email, password, fullName, companyName) => { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, company_name: companyName } } }); if (error) throw error },
  signOut: async () => { await supabase.auth.signOut(); set({ user: null }) }
}))
