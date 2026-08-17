import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types'

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  permissionKeys: Set<string>
  loading: boolean
  deactivated: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshPermissions: () => Promise<void>
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

async function fetchPermissionKeys(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('user_permissions').select('permissions(key)').eq('user_id', userId)

  if (error) {
    console.error('Failed to load permissions:', error.message)
    return new Set()
  }

  const rows = data as unknown as { permissions: { key: string } | null }[]
  return new Set(rows.map((row) => row.permissions?.key).filter((k): k is string => !!k))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [permissionKeys, setPermissionKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [deactivated, setDeactivated] = useState(false)

  // Loads profile + permissions for a session, and signs out (without
  // clearing the "deactivated" notice) if the account has been disabled.
  async function loadUserState(userId: string) {
    const loadedProfile = await fetchProfile(userId)

    if (loadedProfile && !loadedProfile.is_active) {
      setDeactivated(true)
      setProfile(null)
      setPermissionKeys(new Set())
      await supabase.auth.signOut()
      return
    }

    setProfile(loadedProfile)
    setPermissionKeys(loadedProfile ? await fetchPermissionKeys(userId) : new Set())
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
        setPermissionKeys(new Set())
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

  async function refreshPermissions() {
    if (session?.user) {
      setPermissionKeys(await fetchPermissionKeys(session.user.id))
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        permissionKeys,
        loading,
        deactivated,
        signIn,
        signOut,
        refreshProfile,
        refreshPermissions,
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
