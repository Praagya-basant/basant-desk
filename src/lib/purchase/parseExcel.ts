import * as XLSX from 'xlsx'

export async function parseExcelDescriptions(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })

  let headerRowIndex = rows.findIndex((row) => typeof row[0] === 'string' && /description/i.test(row[0]))
  if (headerRowIndex === -1) headerRowIndex = -1 // no header found — treat every row as data

  return rows
    .slice(headerRowIndex + 1)
    .map((row) => String(row[0] ?? '').trim())
    .filter((v) => v.length > 0)
}
