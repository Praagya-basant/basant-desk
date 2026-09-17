/** Shared toast for the 5s undo window after deleting one or more tasks —
 * see src/hooks/useUndoableDelete.ts. Fixed-position so it doesn't affect
 * page layout, and cm-no-print since it's a transient UI affordance. */
export default function DeleteUndoToast({ count, onUndo }: { count: number; onUndo: () => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border border-border bg-text text-bg px-4 py-2.5 text-sm shadow-lg cm-no-print">
      <span>
        {count} task{count === 1 ? '' : 's'} deleted
      </span>
      <button onClick={onUndo} className="font-medium underline underline-offset-2 hover:no-underline">
        Undo
      </button>
    </div>
  )
}
