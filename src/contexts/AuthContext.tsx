import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types'
import type { AccessLevel } from '../config/modules'

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  /** module_key → resolved access level, from core.my_module_access(). */
  moduleAccess: Map<string, AccessLevel>
  loading: boolean
  deactivated: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshAccess: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()

  if (error) {
    console.error('Failed to load profile:', error.message)
    return null
  }

  return data as UserProfile
}

async function fetchModuleAccess(): Promise<Map<string, AccessLevel>> {
  const { data, error } = await supabase.rpc('my_module_access')

  if (error) {
    console.error('Failed to load module access:', error.message)
    return new Map()
  }

  const rows = (data as { module_key: string; level: AccessLevel }[]) ?? []
  return new Map(rows.map((r) => [r.module_key, r.level]))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [moduleAccess, setModuleAccess] = useState<Map<string, AccessLevel>>(new Map())
  const [loading, setLoading] = useState(true)
  const [deactivated, setDeactivated] = useState(false)

  // Loads profile + resolved access for a session, and signs out (without
  // clearing the "deactivated" notice) if the account has been disabled.
  async function loadUserState(userId: string) {
    const loadedProfile = await fetchProfile(userId)

    if (loadedProfile && !loadedProfile.is_active) {
      setDeactivated(true)
      setProfile(null)
      setModuleAccess(new Map())
      await supabase.auth.signOut()
      return
    }

    setProfile(loadedProfile)
    setModuleAccess(loadedProfile ? await fetchModuleAccess() : new Map())
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      if (session?.user) {
        await loadUserState(session.user.id)
      }
      if (mounted) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      setSession(session)
      if (session?.user) {
        await loadUserState(session.user.id)
      } else {
        setProfile(null)
        setModuleAccess(new Map())
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    setDeactivated(false)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        return { error: 'Incorrect email or password.' }
      }
      return { error: error.message }
    }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (session?.user) {
      await loadUserState(session.user.id)
    }
  }

  async function refreshAccess() {
    if (session?.user) {
      setModuleAccess(await fetchModuleAccess())
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        moduleAccess,
        loading,
        deactivated,
        signIn,
        signOut,
        refreshProfile,
        refreshAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
