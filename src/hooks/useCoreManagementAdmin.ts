import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/** Wraps the core.is_core_management_admin() RPC — the same allowlist check
 * RLS enforces server-side, so the UI never shows access it can't back up. */
export function useCoreManagementAdmin() {
  const { session } = useAuth()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    if (!session?.user) {
      setAllowed(false)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase.rpc('is_core_management_admin').then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        console.error('Failed to check core management access:', error.message)
        setAllowed(false)
      } else {
        setAllowed(Boolean(data))
      }
      setLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [session?.user?.id])

  return { allowed, loading }
}
