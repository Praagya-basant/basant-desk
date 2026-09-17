import { NavLink } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { navLinkClass } from './navLinkClass'

/** Sales department root (/sales) — just the one module so far. Mirrors
 * SalesHome's card. Once inside /sales/mcsp the sidebar swaps to McspNav. */
export default function SalesNav() {
  return (
    <div className="space-y-0.5">
      <NavLink to="/sales/mcsp" className={navLinkClass}>
        <Layers size={16} strokeWidth={1.75} />
        MCSP
      </NavLink>
    </div>
  )
}
