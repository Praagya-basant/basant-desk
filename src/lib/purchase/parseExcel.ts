import * as XLSX from 'xlsx'
import { getDescriptionsFromSheet } from './extractHCRows'

export async function parseExcelDescriptions(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  return getDescriptionsFromSheet(rows)
}
