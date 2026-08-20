import { X } from 'lucide-react'
import type { TabDescriptor } from '../hooks/useTabs'

export default function TabBar({
  tabs,
  activeTabId,
  anchorTabId,
  onActivate,
  onClose,
}: {
  tabs: TabDescriptor[]
  activeTabId: string
  anchorTabId: string
  onActivate: (tabId: string) => void
  onClose: (tabId: string) => void
}) {
  if (tabs.length <= 1) return null

  return (
    <div className="flex items-center gap-1 px-4 pt-2 border-b border-border overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const closable = tab.id !== anchorTabId

        return (
          <button
            key={tab.id}
            onClick={() => onActivate(tab.id)}
            className={`group flex items-center gap-2 shrink-0 whitespace-nowrap px-3 py-1.5 text-sm rounded-t-md border border-b-0 transition-colors ${
              isActive
                ? 'bg-bg text-text border-border'
                : 'bg-surface text-text-secondary border-transparent hover:text-text'
            }`}
          >
            <span>{tab.label}</span>
            {closable && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
                className="text-text-secondary hover:text-text rounded-sm"
              >
                <X size={13} strokeWidth={2} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
