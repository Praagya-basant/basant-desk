import * as XLSX from 'xlsx'

// Plain spreadsheet dump via SheetJS — same approach as the old Yaamya app.
// (Core Management's exceljs-based styled exporter is task-table specific;
// the Inward Log just needs a clean data export.) xlsx is already in the
// main bundle via src/lib/purchase/parseExcel.ts, so this imports statically.
export function exportToExcel(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = 'Sheet1',
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}
