import { useRef, useState } from 'react'

/** Optimistically removes item(s) from view immediately, but only commits
 * the real (soft-)delete after a 5s grace window — Undo during that window
 * cancels the pending commit; the caller is responsible for putting the
 * item(s) back into its own list state. Single delete and bulk delete are
 * the same operation here (`requestDelete` accepts either one item or an
 * array) — a bulk delete gets one combined toast and one combined commit
 * call, not N separate ones, which is what actually made multi-delete
 * unreliable before: N independent 5s timers racing against N independent
 * "is something already pending" checks. Only one batch is tracked at a
 * time: requesting a new delete while one is still pending immediately
 * commits the previous batch rather than silently dropping it. */
export function useUndoableDelete<T>(commit: (items: T[]) => void | Promise<void>) {
  const [pendingDelete, setPendingDelete] = useState<T[] | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flush() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function requestDelete(items: T | T[]) {
    const batch = Array.isArray(items) ? items : [items]
    if (batch.length === 0) return
    if (pendingDelete) {
      flush()
      commit(pendingDelete)
    }
    setPendingDelete(batch)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setPendingDelete(null)
      commit(batch)
    }, 5000)
  }

  function undo() {
    flush()
    setPendingDelete(null)
  }

  return { pendingDelete, requestDelete, undo }
}
