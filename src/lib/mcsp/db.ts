import { supabase } from '../supabase'
import type {
  Buyer,
  Hall,
  ItemType,
  Movement,
  MovementWithRelations,
  Panel,
  PanelMovement,
  PanelMovementWithRelations,
  PanelWithRelations,
  RecallRequest,
  RecallRequestWithRelations,
  RequestItemRef,
  Sample,
  SampleComment,
  SampleWithRelations,
  ShiftRequest,
  ShiftRequestWithRelations,
  ValidityChange,
  ValidityRequestWithRelations,
} from './dbTypes'

const mcsp = () => supabase.schema('mcsp')

const SAMPLE_SELECT = '*, buyer:buyer_id(id, name), hall:hall_id(id, hall_number, name)'
const PANEL_SELECT = '*, buyer:buyer_id(id, name), hall:hall_id(id, hall_number, name)'

// ---------------------------------------------------------------------------
// Halls / Buyers
// ---------------------------------------------------------------------------

export async function fetchHalls(): Promise<Hall[]> {
  const { data, error } = await mcsp().from('halls').select('*').order('hall_number')
  if (error) throw error
  return data as Hall[]
}

export async function fetchBuyers(): Promise<Buyer[]> {
  const { data, error } = await mcsp().from('buyers').select('*').order('name')
  if (error) throw error
  return data as Buyer[]
}

export async function createBuyer(name: string): Promise<Buyer> {
  const { data, error } = await mcsp().from('buyers').insert({ name }).select('*').single()
  if (error) throw error
  return data as Buyer
}

export async function createHall(hallNumber: number, name: string): Promise<Hall> {
  const { data, error } = await mcsp().from('halls').insert({ hall_number: hallNumber, name }).select('*').single()
  if (error) throw error
  return data as Hall
}

export async function deleteBuyer(buyerId: string): Promise<void> {
  const { error } = await mcsp().rpc('delete_buyer', { p_buyer_id: buyerId })
  if (error) throw error
}

export async function updateBuyer(buyerId: string, name: string): Promise<void> {
  const { error } = await mcsp().rpc('update_buyer', { p_buyer_id: buyerId, p_name: name })
  if (error) throw error
}

export async function updateHall(hallId: string, hallNumber: number, name: string): Promise<void> {
  const { error } = await mcsp().rpc('update_hall', { p_hall_id: hallId, p_hall_number: hallNumber, p_name: name })
  if (error) throw error
}

export async function deleteHall(hallId: string): Promise<void> {
  const { error } = await mcsp().rpc('delete_hall', { p_hall_id: hallId })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Samples (MCS)
// ---------------------------------------------------------------------------

export async function listSamples(): Promise<SampleWithRelations[]> {
  const { data, error } = await mcsp().from('samples').select(SAMPLE_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as SampleWithRelations[]
}

export async function getSample(id: string): Promise<SampleWithRelations> {
  const { data, error } = await mcsp().from('samples').select(SAMPLE_SELECT).eq('id', id).single()
  if (error) throw error
  return data as unknown as SampleWithRelations
}

function computeExpiry(signedDate?: string, validityMonths?: number, expiryDate?: string): string | null {
  if (expiryDate) return expiryDate
  if (signedDate && validityMonths) {
    const d = new Date(signedDate)
    d.setMonth(d.getMonth() + validityMonths)
    return d.toISOString().slice(0, 10)
  }
  return null
}

export async function createSample(params: {
  buyerId: string
  hallId: string
  btCode: string
  productRef?: string
  productName: string
  collectionName?: string
  signedBy?: string
  signedDate?: string
  validityMonths?: number
  expiryDate?: string
  dateAddedToHall?: string
  imageUrl?: string
}): Promise<Sample> {
  const { data, error } = await mcsp()
    .from('samples')
    .insert({
      buyer_id: params.buyerId,
      hall_id: params.hallId,
      bt_code: params.btCode,
      product_ref: params.productRef || null,
      product_name: params.productName,
      collection_name: params.collectionName || null,
      signed_by: params.signedBy || null,
      signed_date: params.signedDate || null,
      validity_months: params.validityMonths || null,
      expiry_date: computeExpiry(params.signedDate, params.validityMonths, params.expiryDate),
      date_added_to_hall: params.dateAddedToHall || null,
      image_url: params.imageUrl || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Sample
}

export async function listMovements(): Promise<MovementWithRelations[]> {
  const { data, error } = await mcsp()
    .from('movements')
    .select('*, sample:sample_id(bt_code, product_name)')
    .order('picked_at', { ascending: false })
  if (error) throw error
  return data as unknown as MovementWithRelations[]
}

export async function listMovementsForSample(sampleId: string): Promise<Movement[]> {
  const { data, error } = await mcsp()
    .from('movements')
    .select('*')
    .eq('sample_id', sampleId)
    .order('picked_at', { ascending: false })
  if (error) throw error
  return data as Movement[]
}

export async function checkoutSample(params: {
  sampleId: string
  pickedByName: string
  pickedByEmail?: string
  destination: string
  reason: string
  reasonOther?: string
  notes?: string
  purchaserName?: string
  supplierName?: string
  photoUrl?: string
}): Promise<Movement> {
  const { data, error } = await mcsp().rpc('checkout_sample', {
    p_sample_id: params.sampleId,
    p_picked_by_name: params.pickedByName,
    p_picked_by_email: params.pickedByEmail ?? null,
    p_destination: params.destination,
    p_reason: params.reason,
    p_reason_other: params.reasonOther ?? null,
    p_notes: params.notes ?? null,
    p_purchaser_name: params.purchaserName ?? null,
    p_supplier_name: params.supplierName ?? null,
    p_photo_url: params.photoUrl ?? null,
  })
  if (error) throw error
  // Fire-and-forget — an in-app notification failing to write must never
  // roll back or block a checkout that already succeeded.
  mcsp()
    .rpc('notify_checkout', { p_sample_id: params.sampleId, p_destination: params.destination })
    .then(({ error: notifyError }) => {
      if (notifyError) console.error('Failed to notify checkout:', notifyError.message)
    })
  return data as Movement
}

export async function returnSample(movementId: string, photoUrl?: string): Promise<Movement> {
  const { data, error } = await mcsp().rpc('return_sample', { p_movement_id: movementId })
  if (error) throw error
  // return_sample() doesn't take a photo param in the original app (return
  // photos weren't part of its RPC signature) — if a condition photo was
  // captured, attach it directly to the now-closed movement row.
  if (photoUrl) {
    await mcsp().from('movements').update({ photo_url: photoUrl }).eq('id', movementId)
  }
  const sampleId = (data as Movement).sample_id
  mcsp()
    .rpc('notify_return', { p_sample_id: sampleId })
    .then(({ error: notifyError }) => {
      if (notifyError) console.error('Failed to notify return:', notifyError.message)
    })
  return data as Movement
}

export async function forwardSample(params: {
  movementId: string
  pickedByName: string
  pickedByEmail?: string
  destination: string
  reason: string
  reasonOther?: string
  notes?: string
  purchaserName?: string
  supplierName?: string
}): Promise<Movement> {
  const { data, error } = await mcsp().rpc('forward_sample', {
    p_movement_id: params.movementId,
    p_picked_by_name: params.pickedByName,
    p_picked_by_email: params.pickedByEmail ?? null,
    p_destination: params.destination,
    p_reason: params.reason,
    p_reason_other: params.reasonOther ?? null,
    p_notes: params.notes ?? null,
    p_purchaser_name: params.purchaserName ?? null,
    p_supplier_name: params.supplierName ?? null,
  })
  if (error) throw error
  return data as Movement
}

/** The open ('out') movement for a checked-out sample, if any — needed to Return/Forward it. */
export async function getOpenMovement(sampleId: string): Promise<Movement | null> {
  const { data, error } = await mcsp()
    .from('movements')
    .select('*')
    .eq('sample_id', sampleId)
    .eq('status', 'out')
    .order('picked_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Movement | null
}

export async function updateSampleHall(sampleId: string, hallId: string): Promise<Sample> {
  const { data, error } = await mcsp().from('samples').update({ hall_id: hallId }).eq('id', sampleId).select('*').single()
  if (error) throw error
  return data as Sample
}

export async function deleteSample(sampleId: string): Promise<void> {
  const { error } = await mcsp().rpc('delete_sample', { p_sample_id: sampleId })
  if (error) throw error
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
}

export async function uploadImage(file: File): Promise<string> {
  // Storage isn't schema-scoped like .from()/.rpc() — always supabase.storage,
  // regardless of which Postgres schema mcsp() points .from()/.rpc() at.
  const nameExt = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  const ext = /^[a-z0-9]{2,5}$/.test(nameExt) ? nameExt : EXT_BY_TYPE[file.type] ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('mcsp-images').upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from('mcsp-images').getPublicUrl(path)
  return data.publicUrl
}

export async function setSampleImage(sampleId: string, imageUrl: string): Promise<Sample> {
  const { data, error } = await mcsp().rpc('set_sample_image', { p_sample_id: sampleId, p_image_url: imageUrl })
  if (error) throw error
  return data as Sample
}

// ---------------------------------------------------------------------------
// Comments & Recalls
// ---------------------------------------------------------------------------

export async function listSampleComments(sampleId: string): Promise<SampleComment[]> {
  const { data, error } = await mcsp()
    .from('sample_comments')
    .select('*')
    .eq('sample_id', sampleId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as SampleComment[]
  // Resolve author names with a plain core.users lookup rather than a
  // cross-schema PostgREST embed (mcsp → core embeds are unreliable).
  const names = await resolveUserNames(rows.map((r) => r.author_id))
  return rows.map((r) => ({ ...r, author: names.has(r.author_id) ? { full_name: names.get(r.author_id)!, email: '' } : null }))
}

export async function addSampleComment(sampleId: string, authorId: string, comment: string): Promise<void> {
  const { error } = await mcsp().from('sample_comments').insert({ sample_id: sampleId, author_id: authorId, comment })
  if (error) throw error
}

export async function raiseRecall(sampleId: string, requestedBy: string, reason: string): Promise<void> {
  const { error } = await mcsp().from('recall_requests').insert({ sample_id: sampleId, requested_by: requestedBy, reason })
  if (error) throw error
}

export async function listRecallRequests(sampleId: string): Promise<RecallRequest[]> {
  const { data, error } = await mcsp().from('recall_requests').select('*').eq('sample_id', sampleId).order('created_at', { ascending: false })
  if (error) throw error
  return data as RecallRequest[]
}

/** Every recall in the system (RLS narrows to the caller's scope) joined to its
 * sample + buyer/hall + requester name — what the Recalls review queue reads. */
export async function listAllRecalls(): Promise<RecallRequestWithRelations[]> {
  const { data, error } = await mcsp()
    .from('recall_requests')
    .select('*, sample:sample_id(bt_code, product_name, buyer:buyer_id(name), hall:hall_id(name))')
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as RecallRequestWithRelations[]
  const names = await resolveUserNames(rows.map((r) => r.requested_by))
  return rows.map((r) => ({ ...r, requester: names.get(r.requested_by) ?? null }))
}

export async function updateRecallStatus(id: string, status: 'acknowledged' | 'resolved'): Promise<void> {
  const { error } = await mcsp().from('recall_requests').update({ status }).eq('id', id)
  if (error) throw error
}

export async function countOpenRecalls(): Promise<number> {
  const { count, error } = await mcsp()
    .from('recall_requests')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'resolved')
  if (error) throw error
  return count ?? 0
}

/** Resolve a set of core.users ids to display names without a cross-schema
 * PostgREST embed (those are brittle — see docs/mcsp.md issue notes). */
export async function resolveUserNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))]
  const out = new Map<string, string>()
  if (unique.length === 0) return out
  const { data } = await supabase.from('users').select('id, full_name, email').in('id', unique)
  for (const u of (data ?? []) as { id: string; full_name: string | null; email: string }[]) {
    out.set(u.id, u.full_name || u.email)
  }
  return out
}

// ---------------------------------------------------------------------------
// Panels (MCP)
// ---------------------------------------------------------------------------

export async function listPanels(): Promise<PanelWithRelations[]> {
  const { data, error } = await mcsp().from('panels').select(PANEL_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as PanelWithRelations[]
}

export async function getPanel(id: string): Promise<PanelWithRelations> {
  const { data, error } = await mcsp().from('panels').select(PANEL_SELECT).eq('id', id).single()
  if (error) throw error
  return data as unknown as PanelWithRelations
}

export async function createPanel(params: {
  buyerId: string
  hallId: string
  panelCode?: string
  panelName: string
  panelRef?: string
  panelFinish?: string
  finishRecipe?: string
  isShared?: boolean
  collectionName?: string
  signedBy?: string
  signedDate?: string
  validityMonths?: number
  expiryDate?: string
  imageUrl?: string
}): Promise<Panel> {
  const { data, error } = await mcsp()
    .from('panels')
    .insert({
      buyer_id: params.buyerId,
      hall_id: params.hallId,
      panel_code: params.panelCode || null,
      panel_name: params.panelName,
      panel_ref: params.panelRef || null,
      panel_finish: params.panelFinish || null,
      finish_recipe: params.finishRecipe || null,
      is_shared: params.isShared ?? false,
      collection_name: params.collectionName || null,
      signed_by: params.signedBy || null,
      signed_date: params.signedDate || null,
      validity_months: params.validityMonths || null,
      expiry_date: computeExpiry(params.signedDate, params.validityMonths, params.expiryDate),
      image_url: params.imageUrl || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Panel
}

export async function listPanelMovements(): Promise<PanelMovementWithRelations[]> {
  const { data, error } = await mcsp()
    .from('panel_movements')
    .select('*, panel:panel_id(panel_code, panel_name)')
    .order('picked_at', { ascending: false })
  if (error) throw error
  return data as unknown as PanelMovementWithRelations[]
}

export async function listPanelMovementsForPanel(panelId: string): Promise<PanelMovement[]> {
  const { data, error } = await mcsp()
    .from('panel_movements')
    .select('*')
    .eq('panel_id', panelId)
    .order('picked_at', { ascending: false })
  if (error) throw error
  return data as PanelMovement[]
}

export async function getOpenPanelMovement(panelId: string): Promise<PanelMovement | null> {
  const { data, error } = await mcsp()
    .from('panel_movements')
    .select('*')
    .eq('panel_id', panelId)
    .eq('status', 'out')
    .order('picked_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as PanelMovement | null
}

export async function checkoutPanel(params: {
  panelId: string
  pickedByName: string
  pickedByEmail?: string
  destination: string
  reason: string
  reasonOther?: string
  notes?: string
  purchaserName?: string
  supplierName?: string
  photoUrl?: string
  quantity?: number
}): Promise<PanelMovement> {
  const { data, error } = await mcsp().rpc('checkout_panel', {
    p_panel_id: params.panelId,
    p_picked_by_name: params.pickedByName,
    p_picked_by_email: params.pickedByEmail ?? null,
    p_destination: params.destination,
    p_reason: params.reason,
    p_reason_other: params.reasonOther ?? null,
    p_notes: params.notes ?? null,
    p_purchaser_name: params.purchaserName ?? null,
    p_supplier_name: params.supplierName ?? null,
    p_photo_url: params.photoUrl ?? null,
    p_quantity: params.quantity ?? null,
  })
  if (error) throw error
  return data as PanelMovement
}

export async function returnPanel(movementId: string, photoUrl?: string): Promise<PanelMovement> {
  const { data, error } = await mcsp().rpc('return_panel', { p_movement_id: movementId })
  if (error) throw error
  if (photoUrl) {
    await mcsp().from('panel_movements').update({ photo_url: photoUrl }).eq('id', movementId)
  }
  return data as PanelMovement
}

export async function retirePanel(panelId: string, reason: string): Promise<Panel> {
  const { data, error } = await mcsp().rpc('retire_panel', { p_panel_id: panelId, p_reason: reason })
  if (error) throw error
  return data as Panel
}

export async function setPanelImage(panelId: string, imageUrl: string): Promise<Panel> {
  const { data, error } = await mcsp().rpc('set_panel_image', { p_panel_id: panelId, p_image_url: imageUrl })
  if (error) throw error
  return data as Panel
}

// ---------------------------------------------------------------------------
// Validity management
// ---------------------------------------------------------------------------

export async function listValidityChanges(itemType: ItemType, itemId: string): Promise<ValidityChange[]> {
  const { data, error } = await mcsp()
    .from('validity_changes')
    .select('*')
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ValidityChange[]
}

export async function adminUpdateValidity(itemType: ItemType, itemId: string, newExpiryDate: string, reason: string): Promise<void> {
  const { error } = await mcsp().rpc('admin_update_validity', {
    p_item_type: itemType,
    p_item_id: itemId,
    p_new_expiry_date: newExpiryDate,
    p_reason: reason,
  })
  if (error) throw error
}

export async function raiseValidityRequest(params: {
  itemType: ItemType
  itemId: string
  requestedBy: string
  requestedMonths?: number
  requestedExpiryDate?: string
  reason?: string
}): Promise<void> {
  const { error } = await mcsp().from('validity_requests').insert({
    item_type: params.itemType,
    item_id: params.itemId,
    requested_by: params.requestedBy,
    requested_months: params.requestedMonths ?? null,
    requested_expiry_date: params.requestedExpiryDate ?? null,
    reason: params.reason ?? null,
  })
  if (error) throw error
}

/** Resolve a batch of polymorphic {item_type,item_id} refs to a display card
 * (code / name / buyer / hall) so review queues can show WHAT is being decided. */
export async function resolveItemRefs(
  refs: { item_type: ItemType; item_id: string }[],
): Promise<Map<string, RequestItemRef>> {
  const out = new Map<string, RequestItemRef>()
  const sampleIds = [...new Set(refs.filter((r) => r.item_type === 'sample').map((r) => r.item_id))]
  const panelIds = [...new Set(refs.filter((r) => r.item_type === 'panel').map((r) => r.item_id))]
  if (sampleIds.length) {
    const { data } = await mcsp()
      .from('samples')
      .select('id, bt_code, product_name, buyer:buyer_id(name), hall:hall_id(name)')
      .in('id', sampleIds)
    for (const s of (data ?? []) as any[]) {
      out.set(s.id, { code: s.bt_code, name: s.product_name, buyerName: s.buyer?.name ?? null, hallName: s.hall?.name ?? null })
    }
  }
  if (panelIds.length) {
    const { data } = await mcsp()
      .from('panels')
      .select('id, panel_code, panel_name, buyer:buyer_id(name), hall:hall_id(name)')
      .in('id', panelIds)
    for (const p of (data ?? []) as any[]) {
      out.set(p.id, { code: p.panel_code ?? '—', name: p.panel_name, buyerName: p.buyer?.name ?? null, hallName: p.hall?.name ?? null })
    }
  }
  return out
}

export async function listValidityRequests(): Promise<ValidityRequestWithRelations[]> {
  const { data, error } = await mcsp().from('validity_requests').select('*').order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as ValidityRequestWithRelations[]
  const [items, names] = await Promise.all([
    resolveItemRefs(rows.map((r) => ({ item_type: r.item_type, item_id: r.item_id }))),
    resolveUserNames(rows.map((r) => r.requested_by)),
  ])
  return rows.map((r) => ({ ...r, item: items.get(r.item_id) ?? null, requester: names.get(r.requested_by) ?? null }))
}

export async function reviewValidityRequest(requestId: string, approve: boolean, adminNote?: string): Promise<void> {
  const { error } = await mcsp().rpc('review_validity_request', {
    p_request_id: requestId,
    p_approve: approve,
    p_admin_note: adminNote ?? null,
  })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Hall shift requests
// ---------------------------------------------------------------------------

export async function listShiftRequests(): Promise<ShiftRequestWithRelations[]> {
  const { data, error } = await mcsp()
    .from('shift_requests')
    .select('*, from_hall:from_hall_id(name), to_hall:to_hall_id(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as ShiftRequestWithRelations[]
  const [items, names] = await Promise.all([
    resolveItemRefs(rows.map((r) => ({ item_type: r.item_type, item_id: r.item_id }))),
    resolveUserNames(rows.map((r) => r.requested_by)),
  ])
  return rows.map((r) => ({ ...r, item: items.get(r.item_id) ?? null, requester: names.get(r.requested_by) ?? null }))
}

export async function raiseShiftRequest(params: {
  itemType: ItemType
  itemId: string
  fromHallId: string
  toHallId: string
  requestedBy: string
  note?: string
}): Promise<void> {
  const { data, error } = await mcsp()
    .from('shift_requests')
    .insert({
      item_type: params.itemType,
      item_id: params.itemId,
      from_hall_id: params.fromHallId,
      to_hall_id: params.toHallId,
      requested_by: params.requestedBy,
      note: params.note ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  const requestId = (data as { id: string }).id
  mcsp()
    .rpc('notify_shift_requested', { p_request_id: requestId })
    .then(({ error: notifyError }) => {
      if (notifyError) console.error('Failed to notify shift request:', notifyError.message)
    })
}

export async function reviewShiftRequest(requestId: string, approve: boolean, adminNote?: string): Promise<ShiftRequest> {
  const { data, error } = await mcsp().rpc('review_shift_request', {
    p_request_id: requestId,
    p_approve: approve,
    p_admin_note: adminNote ?? null,
  })
  if (error) throw error
  return data as ShiftRequest
}
