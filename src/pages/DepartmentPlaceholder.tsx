import type { Department } from '../config/departments'

export default function DepartmentPlaceholder({ department }: { department: Department }) {
  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-medium text-text mb-1">{department.label}</h1>
      <p className="text-sm text-text-secondary">{department.label} module — coming soon.</p>
    </div>
  )
}
