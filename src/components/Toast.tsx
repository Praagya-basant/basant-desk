import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

export default function Toast({
  message,
  onDismiss,
  duration = 3000,
}: {
  message: string
  onDismiss: () => void
  duration?: number
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [onDismiss, duration])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-3 text-sm text-text shadow-sm">
      <CheckCircle2 size={16} strokeWidth={1.75} className="text-text-secondary shrink-0" />
      {message}
    </div>
  )
}
