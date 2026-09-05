import ExcelJS from 'exceljs'
import type { MovementWithRelations, PanelMovementWithRelations, PanelWithRelations, SampleWithRelations } from './dbTypes'

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1EF' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF1A1A1A' } }
const BODY_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', size: 10.5, color: { argb: 'FF1A1A1A' } }

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function buyerHeaderLabel(rows: { buyer?: { name: string } | null }[]): string {
  const names = new Set(rows.map((r) => r.buyer?.name).filter(Boolean))
  if (names.size === 1) return [...names][0] as string
  if (names.size === 0) return 'All Buyers'
  return `${names.size} Buyers`
}

function setupSheet(workbook: ExcelJS.Workbook, sheetName: string, title: string, buyerLabel: string, columns: { header: string; width: number }[]) {
  const sheet = workbook.addWorksheet(sheetName)
  sheet.mergeCells(1, 1, 1, columns.length)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `${title} — ${buyerLabel} — ${todayLabel()}`
  titleCell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FF1A1A1A' } }

  sheet.addRow([])
  const headerRow = sheet.addRow(columns.map((c) => c.header))
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8E8E5' } } }
  })
  columns.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.width
  })
  return sheet
}

export async function exportSamplesToExcel(samples: SampleWithRelations[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const columns = [
    { header: 'BT Code', width: 14 },
    { header: 'Product Name', width: 32 },
    { header: 'Product Ref', width: 16 },
    { header: 'Buyer', width: 20 },
    { header: 'Hall', width: 14 },
    { header: 'Status', width: 12 },
    { header: 'Collection', width: 18 },
    { header: 'Signed By', width: 16 },
    { header: 'Signed Date', width: 14 },
    { header: 'Expiry Date', width: 14 },
  ]
  const sheet = setupSheet(workbook, 'Samples', 'MCSP Signed Samples', buyerHeaderLabel(samples), columns)

  for (const s of samples) {
    const row = sheet.addRow([
      s.bt_code,
      s.product_name,
      s.product_ref ?? '',
      s.buyer?.name ?? '',
      s.hall?.name ?? '',
      s.status === 'in_hall' ? 'In Hall' : 'Issued',
      s.collection_name ?? '',
      s.signed_by ?? '',
      s.signed_date ?? '',
      s.expiry_date ?? '',
    ])
    row.eachCell((cell) => {
      cell.font = BODY_FONT
    })
  }

  await saveWorkbook(workbook, `mcsp-samples-${todayLabel().replace(/\s/g, '-')}.xlsx`)
}

export async function exportMovementsToExcel(movements: MovementWithRelations[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const columns = [
    { header: 'BT Code', width: 14 },
    { header: 'Product', width: 28 },
    { header: 'Issued To', width: 20 },
    { header: 'Destination', width: 18 },
    { header: 'Reason', width: 16 },
    { header: 'Picked At', width: 20 },
    { header: 'Returned At', width: 20 },
    { header: 'Status', width: 12 },
  ]
  const sheet = setupSheet(workbook, 'Movements', 'MCSP Movements', 'All Buyers', columns)

  for (const m of movements) {
    const row = sheet.addRow([
      m.sample?.bt_code ?? '',
      m.sample?.product_name ?? '',
      m.picked_by_name,
      m.destination,
      m.reason_other || m.reason,
      new Date(m.picked_at).toLocaleString(),
      m.returned_at ? new Date(m.returned_at).toLocaleString() : '',
      m.status === 'returned' ? 'Returned' : 'Out',
    ])
    row.eachCell((cell) => {
      cell.font = BODY_FONT
    })
  }

  await saveWorkbook(workbook, `mcsp-movements-${todayLabel().replace(/\s/g, '-')}.xlsx`)
}

export async function exportPanelsToExcel(panels: PanelWithRelations[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const columns = [
    { header: 'Panel Code', width: 14 },
    { header: 'Panel Name', width: 28 },
    { header: 'Buyer', width: 20 },
    { header: 'Hall', width: 14 },
    { header: 'Status', width: 12 },
    { header: 'Finish', width: 16 },
    { header: 'Shared', width: 10 },
    { header: 'Expiry Date', width: 14 },
  ]
  const sheet = setupSheet(workbook, 'Panels', 'MCSP Counter Panels', buyerHeaderLabel(panels), columns)

  for (const p of panels) {
    const row = sheet.addRow([
      p.panel_code ?? '',
      p.panel_name,
      p.buyer?.name ?? '',
      p.hall?.name ?? '',
      p.status === 'in_hall' ? 'In Hall' : p.status === 'issued' ? 'Issued' : 'Retired',
      p.panel_finish ?? '',
      p.is_shared ? 'Yes' : 'No',
      p.expiry_date ?? '',
    ])
    row.eachCell((cell) => {
      cell.font = BODY_FONT
    })
  }

  await saveWorkbook(workbook, `mcsp-panels-${todayLabel().replace(/\s/g, '-')}.xlsx`)
}

export async function exportPanelMovementsToExcel(movements: PanelMovementWithRelations[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const columns = [
    { header: 'Panel Code', width: 14 },
    { header: 'Panel Name', width: 28 },
    { header: 'Issued To', width: 20 },
    { header: 'Destination', width: 18 },
    { header: 'Reason', width: 16 },
    { header: 'Quantity', width: 10 },
    { header: 'Picked At', width: 20 },
    { header: 'Returned At', width: 20 },
    { header: 'Status', width: 12 },
  ]
  const sheet = setupSheet(workbook, 'Panel Movements', 'MCSP Panel Movements', 'All Buyers', columns)

  for (const m of movements) {
    const row = sheet.addRow([
      m.panel?.panel_code ?? '',
      m.panel?.panel_name ?? '',
      m.picked_by_name,
      m.destination,
      m.reason_other || m.reason,
      m.quantity ?? '',
      new Date(m.picked_at).toLocaleString(),
      m.returned_at ? new Date(m.returned_at).toLocaleString() : '',
      m.status === 'returned' ? 'Returned' : 'Out',
    ])
    row.eachCell((cell) => {
      cell.font = BODY_FONT
    })
  }

  await saveWorkbook(workbook, `mcsp-panel-movements-${todayLabel().replace(/\s/g, '-')}.xlsx`)
}
