export default function SummaryStrip({
  rowCount,
  totalRate,
  flaggedCount,
  supplier,
}: {
  rowCount: number
  totalRate: number
  flaggedCount: number
  supplier?: string
}) {
  return (
    <div className="flex items-center gap-6 border border-border rounded-lg bg-surface px-4 py-3 mb-4 text-sm">
      {supplier && (
        <div>
          <span className="text-text-secondary">Supplier</span> <span className="text-text font-medium">{supplier}</span>
        </div>
      )}
      <div>
        <span className="text-text-secondary">Rows</span> <span className="text-text font-medium">{rowCount}</span>
      </div>
      <div>
        <span className="text-text-secondary">Total rate</span>{' '}
        <span className="text-text font-medium">{totalRate.toFixed(2)}</span>
      </div>
      {flaggedCount > 0 && (
        <div>
          <span className="text-amber-600">{flaggedCount} flagged</span>
        </div>
      )}
    </div>
  )
}
