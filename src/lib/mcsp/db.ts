import { supabase } from '../supabase'
import type { Buyer, Hall, Movement, MovementWithRelations, Sample, SampleWithRelations } from './dbTypes'

const mcsp = () => supabase.schema('mcsp')

const SAMPLE_SELECT = '*, buyer:buyer_id(id, name), hall:hall_id(id, hall_number, name)'

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
  dateAddedToHall?: string
}): Promise<Sample> {
  const expiryDate =
    params.validityMonths && params.signedDate
      ? new Date(new Date(params.signedDate).setMonth(new Date(params.signedDate).getMonth() + params.validityMonths))
          .toISOString()
          .slice(0, 10)
      : null

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
      expiry_date: expiryDate,
      date_added_to_hall: params.dateAddedToHall || null,
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
  })
  if (error) throw error
  return data as Movement
}

export async function returnSample(movementId: string): Promise<Movement> {
  const { data, error } = await mcsp().rpc('return_sample', { p_movement_id: movementId })
  if (error) throw error
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

export async function uploadSampleImage(file: File): Promise<string> {
  // Storage isn't schema-scoped like .from()/.rpc() — always supabase.storage,
  // regardless of which Postgres schema mcsp() points .from()/.rpc() at.
  const ext = file.name.split('.').pop()
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
