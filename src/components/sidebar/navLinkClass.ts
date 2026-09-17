// Shared active/inactive styling for every sidebar nav link, so the
// department list and every department's contextual nav look identical.
export const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive ? 'bg-bg text-text border border-border' : 'text-text-secondary hover:text-text'
  }`
