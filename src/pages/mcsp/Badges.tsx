import { getValidityStatus } from '../../lib/mcsp/dbTypes'
import type { SampleStatus, PanelStatus } from '../../lib/mcsp/dbTypes'

// Soft-tint pills built from the design-system semantic tokens
// (docs/design-system.md): --success / --warning / --info, at 10% opacity for
// the fill. No raw Tailwind palette colours.

const pill = 'text-xs px-2 py-0.5 rounded-full'

export function StatusBadge({ status }: { status: SampleStatus | PanelStatus }) {
  if (status === 'retired') {
    return <span className={`${pill} bg-surface-2 text-text-secondary`}>Retired</span>
  }
  const isInHall = status === 'in_hall'
  return (
    <span className={`${pill} ${isInHall ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
      {isInHall ? 'In Hall' : 'Issued'}
    </span>
  )
}

export function ValidityBadge({ expiryDate }: { expiryDate: string | null }) {
  const validity = getValidityStatus(expiryDate)
  if (validity === 'none') return <span className="text-xs text-text-muted">No expiry set</span>
  if (validity === 'valid') return <span className={`${pill} bg-success/10 text-success`}>Valid</span>
  if (validity === 'expiring_soon') return <span className={`${pill} bg-warning/10 text-warning`}>Expiring Soon</span>
  return <span className={`${pill} bg-warning/20 text-warning font-medium`}>Expired</span>
}
