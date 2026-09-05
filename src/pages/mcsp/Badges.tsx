import { getValidityStatus } from '../../lib/mcsp/dbTypes'
import type { SampleStatus, PanelStatus } from '../../lib/mcsp/dbTypes'

// Design-system tokens only (docs/design-system.md): --success/--warning/--info
// map to Tailwind's green-*/amber-*/blue-* here since the platform hasn't
// defined semantic badge-tint utilities yet — same soft-tint pill pattern
// already used in Samples.tsx.

export function StatusBadge({ status }: { status: SampleStatus | PanelStatus }) {
  if (status === 'retired') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary">Retired</span>
  }
  const isInHall = status === 'in_hall'
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${isInHall ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
    >
      {isInHall ? 'In Hall' : 'Issued'}
    </span>
  )
}

export function ValidityBadge({ expiryDate }: { expiryDate: string | null }) {
  const validity = getValidityStatus(expiryDate)
  if (validity === 'none') return <span className="text-xs text-text-muted">—</span>
  if (validity === 'valid') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Valid</span>
  if (validity === 'expiring_soon')
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 animate-pulse">Expiring Soon</span>
    )
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">Expired</span>
}
