import { ACCESS_LEVELS, type AccessLevel } from '../../../config/modules'

const LABELS: Record<AccessLevel, string> = {
  none: 'None',
  view: 'View',
  edit: 'Edit',
  approve: 'Approve',
  admin: 'Admin',
}

/** Segmented none…admin control. `allowed` limits which levels are offered
 * (a department admin can't grant above their own ceiling in some contexts). */
export default function LevelSelect({
  value,
  onChange,
  disabled = false,
  allowed = ACCESS_LEVELS,
}: {
  value: AccessLevel
  onChange: (level: AccessLevel) => void
  disabled?: boolean
  allowed?: AccessLevel[]
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden bg-bg">
      {ACCESS_LEVELS.map((lvl) => {
        const isSelected = lvl === value
        const isAllowed = allowed.includes(lvl)
        return (
          <button
            key={lvl}
            type="button"
            disabled={disabled || !isAllowed}
            onClick={() => onChange(lvl)}
            className={`px-2.5 py-1 text-xs transition-colors border-r border-border last:border-r-0 ${
              isSelected
                ? 'bg-accent text-white font-medium'
                : 'text-text-secondary hover:text-text hover:bg-surface-2'
            } ${disabled || !isAllowed ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {LABELS[lvl]}
          </button>
        )
      })}
    </div>
  )
}
