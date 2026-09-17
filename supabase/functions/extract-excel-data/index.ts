// Bulk Excel import for MCSP (Sales) — one upload does everything: parses
// row data (samples or panels), extracts embedded images by position, uploads
// them to Storage, and inserts the rows, all server-side so the browser never
// has to hold the whole workbook + every image in memory at once.
//
// Column mapping is name-based and case/punctuation-insensitive (see
// detectColumns/ALIASES below) — not a fixed template. Duplicate bt_code /
// panel_code (against the DB, and within the same file) are skipped, not
// errored — see docs/mcsp.md "Bulk Excel import".
//
// Caller must be a Sales admin/dept-admin (mirrors the Buyers/Halls/Users/
// Recalls pages' RequireAdminOrDeptAdmin gate) — this function uses the
// service-role key and bypasses RLS entirely, so it enforces that itself.
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'
import JSZip from 'npm:jszip@3.10.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Column detection — case/punctuation-insensitive name matching
// ---------------------------------------------------------------------------

type LogicalField =
  | 'code'
  | 'productName'
  | 'productRef'
  | 'hall'
  | 'collectionName'
  | 'signedBy'
  | 'signedDate'
  | 'validityMonths'
  | 'expiryDate'
  | 'panelFinish'
  | 'finishRecipe'
  | 'isShared'

function normalizeHeader(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const BASE_ALIASES: Partial<Record<LogicalField, string[]>> = {
  productName: ['product name', 'name', 'description', 'product'],
  productRef: ['product ref', 'ref', 'reference', 'buyer ref'],
  hall: ['hall', 'hall no', 'location'],
  collectionName: ['collection', 'collection name'],
  signedBy: ['signed by'],
  signedDate: ['signed date', 'sign date'],
  validityMonths: ['validity', 'validity months'],
  expiryDate: ['expiry', 'expiry date'],
}

const SAMPLE_ALIASES: Partial<Record<LogicalField, string[]>> = {
  ...BASE_ALIASES,
  code: ['bt code', 'sku'],
}

const PANEL_ALIASES: Partial<Record<LogicalField, string[]>> = {
  ...BASE_ALIASES,
  code: ['panel code'],
  panelFinish: ['finish', 'panel finish'],
  finishRecipe: ['finish recipe', 'recipe'],
  isShared: ['shared', 'is shared'],
}

/** First row of raw cells -> { field: columnIndex }. First matching column
 * wins if a header is ambiguous; a field with no matching header is simply
 * absent from the map (that row value stays blank for every row). */
function detectColumns(headerRow: unknown[], aliases: Partial<Record<LogicalField, string[]>>) {
  const columns: Partial<Record<LogicalField, number>> = {}
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell)
    if (!normalized) return
    for (const [field, list] of Object.entries(aliases) as [LogicalField, string[]][]) {
      if (columns[field] === undefined && list.includes(normalized)) {
        columns[field] = index
      }
    }
  })
  return columns
}

// ---------------------------------------------------------------------------
// Cell value coercion
// ---------------------------------------------------------------------------

function cellText(v: unknown): string {
  return String(v ?? '').trim()
}

/** Excel serial date (raw:true numeric cell) or a parseable date string ->
 * 'YYYY-MM-DD', else null. Never throws — a bad date just stays unset. */
function parseDateCell(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel's epoch is 1899-12-30 (accounts for its fictitious 1900 leap day).
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const s = cellText(v)
  if (!s) return null
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function parseMonthsCell(v: unknown): number | null {
  const s = cellText(v)
  const m = s.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

const TRUTHY = new Set(['true', 'yes', 'y', '1', 'shared'])
function parseBoolCell(v: unknown): boolean {
  return TRUTHY.has(cellText(v).toLowerCase())
}

function sanitizePathSegment(v: string): string {
  return v
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\.\./g, '-')
    .replace(/[^\w\-. ()&]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'unknown'
}

function slugify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item'
}

// ---------------------------------------------------------------------------
// Embedded image extraction — an .xlsx is a zip of XML parts;
// xl/worksheets/_rels/sheet1.xml.rels points at the sheet's drawing part,
// xl/drawings/drawingN.xml anchors each picture to a 0-indexed row via
// <xdr:from><xdr:row>, and xl/drawings/_rels/drawingN.xml.rels maps that
// picture's r:embed relationship id to the file under xl/media/. Keyed by
// data-row index (0 = first row after the header), matching how the row
// parser below indexes data rows — a drawing's <xdr:row> is 0-indexed
// against the whole sheet including the header, so dataRowIndex = xdrRow - 1.
// Ported from the original standalone app's extractSpreadsheetImages.js.
// ---------------------------------------------------------------------------

interface ExtractedImage {
  bytes: Uint8Array
  extension: string
  contentType: string
}

const EXT_CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
}

function resolveRelativePath(baseDir: string, target: string): string {
  const parts = baseDir.replace(/\/$/, '').split('/')
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

function extensionFromPath(path: string): string {
  const match = path.match(/\.(png|jpe?g|gif|bmp)$/i)
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'png'
}

async function extractSpreadsheetImages(buffer: ArrayBuffer): Promise<Map<number, ExtractedImage>> {
  const results = new Map<number, ExtractedImage>()

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    // Not a zip at all — a legacy .xls upload. Not an error, just no images.
    return results
  }

  const sheetRelsFile = zip.file('xl/worksheets/_rels/sheet1.xml.rels')
  if (!sheetRelsFile) return results

  const sheetRelsXml = await sheetRelsFile.async('string')
  const drawingRelMatch = sheetRelsXml.match(/<Relationship[^>]*Type="[^"]*\/drawing"[^>]*Target="([^"]+)"/)
  if (!drawingRelMatch) return results

  const drawingPath = resolveRelativePath('xl/worksheets/', drawingRelMatch[1])
  const drawingFile = zip.file(drawingPath)
  if (!drawingFile) return results

  const drawingDir = drawingPath.slice(0, drawingPath.lastIndexOf('/'))
  const drawingName = drawingPath.slice(drawingPath.lastIndexOf('/') + 1)
  const drawingRelsFile = zip.file(`${drawingDir}/_rels/${drawingName}.rels`)

  const embedMap = new Map<string, string>()
  if (drawingRelsFile) {
    const drawingRelsXml = await drawingRelsFile.async('string')
    const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"/g
    let relMatch: RegExpExecArray | null
    while ((relMatch = relRegex.exec(drawingRelsXml))) {
      embedMap.set(relMatch[1], resolveRelativePath(`${drawingDir}/`, relMatch[2]))
    }
  }
  if (embedMap.size === 0) return results

  const drawingXml = await drawingFile.async('string')
  const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g
  let anchorMatch: RegExpExecArray | null
  while ((anchorMatch = anchorRegex.exec(drawingXml))) {
    const block = anchorMatch[1]
    const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
    const embedMatch = block.match(/r:embed="(rId\d+)"/)
    if (!rowMatch || !embedMatch) continue

    const mediaPath = embedMap.get(embedMatch[1])
    if (!mediaPath) continue
    const mediaFile = zip.file(mediaPath)
    if (!mediaFile) continue

    const dataRowIndex = parseInt(rowMatch[1], 10) - 1
    if (dataRowIndex < 0) continue

    const bytes = await mediaFile.async('uint8array')
    const extension = extensionFromPath(mediaPath)
    results.set(dataRowIndex, { bytes, extension, contentType: EXT_CONTENT_TYPE[extension] ?? 'application/octet-stream' })
  }

  return results
}

// ---------------------------------------------------------------------------
// Row model
// ---------------------------------------------------------------------------

interface ParsedRow {
  rowIndex: number // 0-based among data rows — lines up with extractSpreadsheetImages()
  excelRowNumber: number // 1-based, header included — for human-readable error messages
  code: string
  productName: string
  productRef: string
  hallRaw: string
  hallId: string | null
  collectionName: string
  signedBy: string
  signedDate: string | null
  validityMonths: number | null
  expiryDate: string | null
  panelFinish: string
  finishRecipe: string
  isShared: boolean
}

function resolveHall(raw: string, halls: { id: string; name: string; hall_number: number }[]): string | null {
  const value = raw.trim()
  if (!value) return null
  const byName = halls.find((h) => h.name.toLowerCase() === value.toLowerCase())
  if (byName) return byName.id
  const numMatch = value.match(/(\d+)/)
  if (numMatch) {
    const byNumber = halls.find((h) => h.hall_number === Number(numMatch[1]))
    if (byNumber) return byNumber.id
  }
  return null
}

function parseRows(
  sheetRows: unknown[][],
  itemType: 'sample' | 'panel',
  halls: { id: string; name: string; hall_number: number }[],
): ParsedRow[] {
  if (sheetRows.length === 0) return []
  const aliases = itemType === 'sample' ? SAMPLE_ALIASES : PANEL_ALIASES
  const columns = detectColumns(sheetRows[0] as unknown[], aliases)
  const get = (row: unknown[], field: LogicalField) => (columns[field] !== undefined ? row[columns[field]!] : undefined)

  return sheetRows
    .slice(1)
    .map((row, i): ParsedRow => {
      const hallRaw = cellText(get(row, 'hall'))
      return {
        rowIndex: i,
        excelRowNumber: i + 2,
        code: cellText(get(row, 'code')),
        productName: cellText(get(row, 'productName')),
        productRef: cellText(get(row, 'productRef')),
        hallRaw,
        hallId: resolveHall(hallRaw, halls),
        collectionName: cellText(get(row, 'collectionName')),
        signedBy: cellText(get(row, 'signedBy')),
        signedDate: parseDateCell(get(row, 'signedDate')),
        validityMonths: parseMonthsCell(get(row, 'validityMonths')),
        expiryDate: parseDateCell(get(row, 'expiryDate')),
        panelFinish: cellText(get(row, 'panelFinish')),
        finishRecipe: cellText(get(row, 'finishRecipe')),
        isShared: parseBoolCell(get(row, 'isShared')),
      }
    })
    .filter((r) => r.code || r.productName || r.hallRaw)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, error: 'Server misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Missing authorization header' }, 401)

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser()
  if (callerError || !caller) return json({ success: false, error: 'Invalid session' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: callerProfile } = await admin
    .schema('core')
    .from('users')
    .select('role, is_active, department_admin_for')
    .eq('id', caller.id)
    .single()

  const canManageSales =
    callerProfile?.is_active && (callerProfile.role === 'admin' || (callerProfile.department_admin_for ?? []).includes('sales'))
  if (!canManageSales) {
    return json({ success: false, error: 'Only Sales admins can bulk-import MCSP data' }, 403)
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ success: false, error: 'Expected a multipart/form-data upload' }, 400)
  }

  const file = form.get('file')
  const buyerId = form.get('buyer_id')
  const itemTypeRaw = form.get('item_type')

  if (!(file instanceof File)) return json({ success: false, error: 'file is required' }, 400)
  if (typeof buyerId !== 'string' || !buyerId) return json({ success: false, error: 'buyer_id is required' }, 400)
  if (itemTypeRaw !== 'sample' && itemTypeRaw !== 'panel') {
    return json({ success: false, error: "item_type must be 'sample' or 'panel'" }, 400)
  }
  const itemType = itemTypeRaw
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    return json({ success: false, error: 'Only .xlsx and .xls files are accepted' }, 400)
  }

  const { data: buyer, error: buyerError } = await admin.schema('mcsp').from('buyers').select('id, name').eq('id', buyerId).single()
  if (buyerError || !buyer) return json({ success: false, error: 'Buyer not found' }, 400)

  const { data: halls, error: hallsError } = await admin.schema('mcsp').from('halls').select('id, name, hall_number')
  if (hallsError) return json({ success: false, error: `Could not load halls: ${hallsError.message}` }, 500)

  const buffer = await file.arrayBuffer()

  let sheetRows: unknown[][]
  try {
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) throw new Error('The workbook has no sheets.')
    sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][]
  } catch (err) {
    return json({ success: false, error: `Could not read that file: ${(err as Error).message}` }, 400)
  }

  const parsedRows = parseRows(sheetRows, itemType, halls ?? [])
  if (parsedRows.length === 0) {
    return json({ success: false, error: 'No data rows found in that file.' }, 400)
  }

  const errors: string[] = []
  const codeLabel = itemType === 'sample' ? 'BT Code' : 'Panel Code'
  const nameLabel = itemType === 'sample' ? 'Product Name' : 'Panel Name'

  // Validate. Panel Code is optional (nullable + only-unique-when-present in
  // the DB), so a blank code never blocks a panel row — it just can't be
  // deduped or get a filename derived from it.
  const candidateRows = parsedRows.filter((r) => {
    if (itemType === 'sample' && !r.code) {
      errors.push(`Row ${r.excelRowNumber}: missing ${codeLabel}`)
      return false
    }
    if (!r.productName) {
      errors.push(`Row ${r.excelRowNumber}: missing ${nameLabel}`)
      return false
    }
    if (!r.hallId) {
      errors.push(
        r.hallRaw
          ? `Row ${r.excelRowNumber} (${r.code || r.productName}): hall "${r.hallRaw}" not found`
          : `Row ${r.excelRowNumber} (${r.code || r.productName}): missing Hall`,
      )
      return false
    }
    return true
  })

  // Within-file duplicates (only meaningful for rows that actually have a code).
  const seen = new Set<string>()
  const skippedCodes: string[] = []
  const withinFileUnique: ParsedRow[] = []
  for (const r of candidateRows) {
    if (r.code && seen.has(r.code)) {
      skippedCodes.push(r.code)
      continue
    }
    if (r.code) seen.add(r.code)
    withinFileUnique.push(r)
  }

  // Duplicates already in the DB.
  const codesToCheck = withinFileUnique.map((r) => r.code).filter(Boolean)
  let existingCodes = new Set<string>()
  if (codesToCheck.length > 0) {
    if (itemType === 'sample') {
      const { data: existing, error: existingErr } = await admin.schema('mcsp').from('samples').select('bt_code').in('bt_code', codesToCheck)
      if (existingErr) return json({ success: false, error: `Could not check for duplicates: ${existingErr.message}` }, 500)
      existingCodes = new Set((existing ?? []).map((e) => e.bt_code))
    } else {
      const { data: existing, error: existingErr } = await admin.schema('mcsp').from('panels').select('panel_code').in('panel_code', codesToCheck)
      if (existingErr) return json({ success: false, error: `Could not check for duplicates: ${existingErr.message}` }, 500)
      existingCodes = new Set((existing ?? []).map((e) => e.panel_code).filter((c): c is string => !!c))
    }
  }

  const toInsert: ParsedRow[] = []
  for (const r of withinFileUnique) {
    if (r.code && existingCodes.has(r.code)) {
      skippedCodes.push(r.code)
    } else {
      toInsert.push(r)
    }
  }

  // Images — extracted once, matched to rows by position, uploaded only for
  // rows that are actually about to be inserted.
  const imagesByRow = await extractSpreadsheetImages(buffer)
  let imagesUploaded = 0
  const bucket = 'mcsp-images'
  const buyerFolder = sanitizePathSegment(buyer.name)

  const rowsWithImageUrl = await Promise.all(
    toInsert.map(async (r) => {
      const image = imagesByRow.get(r.rowIndex)
      if (!image) return { row: r, imageUrl: null as string | null }
      try {
        const codeForFile = r.code || `${slugify(r.productName)}-${r.rowIndex + 1}`
        const path = `${buyerFolder}/${codeForFile}.${image.extension}`
        const { error: uploadError } = await admin.storage.from(bucket).upload(path, image.bytes, {
          contentType: image.contentType,
          upsert: true,
        })
        if (uploadError) {
          errors.push(`Row ${r.excelRowNumber} (${r.code || r.productName}): image upload failed — ${uploadError.message}`)
          return { row: r, imageUrl: null as string | null }
        }
        const { data: pub } = admin.storage.from(bucket).getPublicUrl(path)
        imagesUploaded += 1
        return { row: r, imageUrl: `${pub.publicUrl}?t=${Date.now()}` }
      } catch (err) {
        errors.push(`Row ${r.excelRowNumber} (${r.code || r.productName}): image upload failed — ${(err as Error).message}`)
        return { row: r, imageUrl: null as string | null }
      }
    }),
  )

  const table = itemType === 'sample' ? 'samples' : 'panels'
  const payload = rowsWithImageUrl.map(({ row: r, imageUrl }) =>
    itemType === 'sample'
      ? {
          buyer_id: buyer.id,
          hall_id: r.hallId,
          bt_code: r.code,
          product_name: r.productName,
          product_ref: r.productRef || null,
          collection_name: r.collectionName || null,
          signed_by: r.signedBy || null,
          signed_date: r.signedDate,
          validity_months: r.validityMonths,
          expiry_date: r.expiryDate,
          image_url: imageUrl,
        }
      : {
          buyer_id: buyer.id,
          hall_id: r.hallId,
          panel_code: r.code || null,
          panel_name: r.productName,
          panel_ref: r.productRef || null,
          panel_finish: r.panelFinish || null,
          finish_recipe: r.finishRecipe || null,
          collection_name: r.collectionName || null,
          signed_by: r.signedBy || null,
          signed_date: r.signedDate,
          validity_months: r.validityMonths,
          expiry_date: r.expiryDate,
          is_shared: r.isShared,
          image_url: imageUrl,
        },
  )

  let imported = 0
  if (payload.length > 0) {
    const { data: inserted, error: insertErr } = await admin.schema('mcsp').from(table).insert(payload).select('id')
    if (insertErr) {
      // A batch insert can fail as a whole on an unexpected constraint hit
      // (e.g. a duplicate that slipped past the pre-check in a race). Fall
      // back to one-by-one so a single bad row doesn't sink the rest.
      for (let i = 0; i < payload.length; i++) {
        const { error: rowErr } = await admin.schema('mcsp').from(table).insert(payload[i])
        const r = rowsWithImageUrl[i].row
        if (rowErr) {
          if (rowErr.message.includes('duplicate key')) {
            if (r.code) skippedCodes.push(r.code)
          } else {
            errors.push(`Row ${r.excelRowNumber} (${r.code || r.productName}): ${rowErr.message}`)
          }
        } else {
          imported += 1
        }
      }
    } else {
      imported = inserted?.length ?? payload.length
    }
  }

  await admin.schema('core').from('activity_log').insert({
    user_id: caller.id,
    department: 'sales',
    action: 'mcsp.bulk_import',
    details: { buyer_id: buyer.id, item_type: itemType, file_name: file.name, imported, skipped: skippedCodes.length, images_uploaded: imagesUploaded },
  })

  return json(
    {
      imported,
      skipped: skippedCodes.length,
      skipped_codes: skippedCodes,
      images_uploaded: imagesUploaded,
      errors,
    },
    200,
  )
})
