import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchWoodMeasurements } from '../lib/yaamya/db'
import type { WoodMeasurement } from '../lib/yaamya/dbTypes'

/** Loads every wood-inward entry and keeps the list live — a manager watching
 * the Inward Log sees pieces land as workers save them, no refresh needed. */
export function useWoodMeasurements() {
  const [entries, setEntries] = useState<WoodMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await fetchWoodMeasurements())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('yaamya-wood-measurements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'yaamya', table: 'wood_measurements' },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { entries, loading, error, reload: load }
}
