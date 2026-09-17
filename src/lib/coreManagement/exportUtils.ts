import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type PrintOrientation = 'portrait' | 'landscape'

export interface ExportColumn {
  key: string
  header: string
  /** Excel column width in characters — omit for a sensible default. */
  width?: number
  /** PDF column width in points (jspdf-autotable) — omit to let autoTable
   * auto-size (fine for non-task exports with few/simple columns; task
   * exports always pass this, from the same weight system TaskTable and
   * PrintTable use, so PDF never drifts out of sync with them). */
  pdfWidth?: number
}

const HEADER_FILL_ARGB = 'FFDBE6FB' // same sky-blue used by print/PDF headers
const BORDER_ARGB = 'FF9FB4E0'
const TEXT_ARGB = 'FF1A1A1A'

/** Real formatted spreadsheet output (bold sky-blue header, borders on every
 * cell, sensible column widths) via exceljs — the xlsx package already in
 * this project (SheetJS Community Edition) has no styling support at all in
 * its free tier, so a raw json_to_sheet dump was the best it could do. */
export async function exportToExcel(columns: ExportColumn[], rows: Record<string, unknown>[], filename: string) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }))

  for (const row of rows) sheet.addRow(row)

  const borderStyle = { style: 'thin' as const, color: { argb: BORDER_ARGB } }
  const border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle }

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: TEXT_ARGB }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL_ARGB } }
    cell.border = border
    cell.alignment = { vertical: 'middle' }
  })

  for (let i = 2; i <= rows.length + 1; i++) {
    sheet.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = border
      cell.font = { color: { argb: TEXT_ARGB }, size: 10 }
      cell.alignment = { vertical: 'top', wrapText: true }
    })
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

/** Styled to match the old sheet's actual printed page — thin sky-blue
 * header, tight borders — same visual language as the .cm-print-table CSS
 * used for the browser Print path, so the two exports look consistent. */
export function exportToPDF(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  filename: string,
  title: string,
  orientation: PrintOrientation = 'landscape',
) {
  const doc = new jsPDF({ orientation, format: 'a4' })
  doc.setFontSize(13)
  doc.setTextColor(26, 26, 26)
  doc.text(title, 10, 12)

  const columnStyles: Record<number, { cellWidth: number }> = {}
  columns.forEach((c, i) => {
    if (c.pdfWidth) columnStyles[i] = { cellWidth: c.pdfWidth }
  })

  autoTable(doc, {
    startY: 17,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ''))),
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [159, 180, 224],
      lineWidth: 0.2,
      textColor: [26, 26, 26],
      overflow: 'linebreak',
    },
    headStyles: { fillColor: [219, 230, 251], textColor: [26, 26, 26], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles,
    // Explicit widths (when provided) should be honored as-is rather than
    // autoTable redistributing space by content — this is what kept PDF
    // column widths consistent with print/Excel instead of drifting.
    tableWidth: Object.keys(columnStyles).length > 0 ? 'wrap' : 'auto',
    margin: { left: 10, right: 10 },
  })
  doc.save(`${filename}.pdf`)
}

/** Rewrites the @page rule injected in index.html so browser Print uses the
 * orientation this specific view wants (most task tables: landscape; prose
 * views like Meetings/Scratch Sheet: portrait) before handing off to the
 * browser's native print dialog. */
export function printCurrentView(orientation: PrintOrientation = 'landscape') {
  let styleTag = document.getElementById('cm-print-page-style') as HTMLStyleElement | null
  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = 'cm-print-page-style'
    document.head.appendChild(styleTag)
  }
  styleTag.textContent = `@page { size: A4 ${orientation}; margin: 12mm; }`
  window.print()
}
