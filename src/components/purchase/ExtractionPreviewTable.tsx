import type { RatedRow } from '../../lib/purchase/types'

export type PreviewField = 'code' | 'l' | 'w' | 'thicknessMm' | 'cell' | 'sheetQty'

interface Props {
  rows: RatedRow[]
  editable: boolean
  onFieldChange?: (index: number, field: PreviewField, value: string) => void
}

function EditableCell({
  value,
  align = 'center',
  onChange,
}: {
  value: string | number | null
  align?: 'left' | 'center'
  onChange: (value: string) => void
}) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-transparent outline-none border-b border-transparent focus:border-border ${
        align === 'center' ? 'text-center' : 'text-left'
      }`}
    />
  )
}

export default function ExtractionPreviewTable({ rows, editable, onFieldChange }: Props) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-text-secondary">
            <th className="font-medium px-4 py-2.5">Code</th>
            <th className="font-medium px-4 py-2.5 text-center">L</th>
            <th className="font-medium px-4 py-2.5 text-center">W</th>
            <th className="font-medium px-4 py-2.5 text-center">Thickness</th>
            <th className="font-medium px-4 py-2.5 text-center">Cell</th>
            <th className="font-medium px-4 py-2.5 text-center">Sheet Qty</th>
            <th className="font-medium px-4 py-2.5 text-right">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-text-secondary">
                No rows.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-border last:border-0 ${
                  row.flagged ? 'border-l-2 border-l-amber-400' : ''
                }`}
              >
                <td className="px-4 py-2.5 text-text align-top">
                  {editable ? (
                    <EditableCell
                      value={row.code}
                      align="left"
                      onChange={(v) => onFieldChange?.(i, 'code', v)}
                    />
                  ) : (
                    row.code || '—'
                  )}
                  {row.flagged && <p className="text-xs text-text-secondary mt-1">{row.flagReason}</p>}
                </td>
                <td className="px-4 py-2.5 text-center text-text align-top">
                  {editable ? (
                    <EditableCell value={row.l} onChange={(v) => onFieldChange?.(i, 'l', v)} />
                  ) : (
                    (row.l ?? '—')
                  )}
                </td>
                <td className="px-4 py-2.5 text-center text-text align-top">
                  {editable ? (
                    <EditableCell value={row.w} onChange={(v) => onFieldChange?.(i, 'w', v)} />
                  ) : (
                    (row.w ?? '—')
                  )}
                </td>
                <td className="px-4 py-2.5 text-center text-text align-top">
                  {editable ? (
                    <EditableCell value={row.thicknessMm} onChange={(v) => onFieldChange?.(i, 'thicknessMm', v)} />
                  ) : (
                    (row.thicknessMm ?? '—')
                  )}
                </td>
                <td className="px-4 py-2.5 text-center text-text align-top">
                  {editable ? (
                    <EditableCell value={row.cell} onChange={(v) => onFieldChange?.(i, 'cell', v)} />
                  ) : (
                    (row.cell ?? '—')
                  )}
                </td>
                <td className="px-4 py-2.5 text-center text-text align-top">
                  {editable ? (
                    <EditableCell value={row.sheetQty} onChange={(v) => onFieldChange?.(i, 'sheetQty', v)} />
                  ) : (
                    row.sheetQty
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-text align-top tabular-nums">
                  {row.rate != null ? row.rate.toFixed(2) : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
