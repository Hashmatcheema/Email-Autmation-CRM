'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  isSales: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSales: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  // When supabase is null (missing env vars / SSR without config), skip auth loading.
  const [loading, setLoading] = useState(supabase !== null)

  async function loadProfile(email: string) {
    if (!supabase) return
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single()
    setProfile((data as UserProfile) ?? null)
  }

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      const s = result.data.session
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user?.email) {
        loadProfile(s.user.email).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, s: Session | null) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user?.email) {
          loadProfile(s.user.email)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    await supabase?.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'
  const isSales = profile?.role === 'sales'

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isAdmin, isSales, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
