// Mirrors the mcsp.* schema (supabase/migrations/0002_mcsp_schema_tables.sql).
// Ported from the standalone BASANT MCSP app — column shapes kept close to
// the original for a clean data copy. See docs/mcsp.md. MCSP now lives
// under the Sales department (department key 'sales') — see migration 0009.

export interface Hall {
  id: string
  hall_number: number
  name: string
  created_at: string
}

export interface Buyer {
  id: string
  name: string
  created_at: string
}

export type SampleStatus = 'in_hall' | 'checked_out'

export interface Sample {
  id: string
  buyer_id: string
  hall_id: string
  bt_code: string
  product_ref: string | null
  product_name: string
  image_url: string | null
  status: SampleStatus
  buyer_code: string | null
  collection_name: string | null
  signed_by: string | null
  signed_date: string | null
  validity_months: number | null
  expiry_date: string | null
  date_added_to_hall: string | null
  created_at: string
}

/** Sample joined with its buyer/hall names — what list/detail views read. */
export interface SampleWithRelations extends Sample {
  buyer: { id: string; name: string } | null
  hall: { id: string; hall_number: number; name: string } | null
}

export type MovementStatus = 'out' | 'returned'

export interface Movement {
  id: string
  sample_id: string
  picked_by_name: string
  picked_by_email: string | null
  destination: string
  reason: string
  reason_other: string | null
  status: MovementStatus
  picked_at: string
  returned_at: string | null
  notes: string | null
  logged_by: string | null
  from_hall_id: string | null
  destination_hall_id: string | null
  purchaser_name: string | null
  supplier_name: string | null
  photo_url: string | null
  signature_url: string | null
  hop_number: number
}

export interface MovementWithRelations extends Movement {
  sample: { bt_code: string; product_name: string } | null
}

export type PanelStatus = 'in_hall' | 'issued' | 'retired'

export interface Panel {
  id: string
  buyer_id: string
  hall_id: string
  panel_code: string | null
  panel_name: string
  panel_ref: string | null
  panel_finish: string | null
  finish_recipe: string | null
  collection_name: string | null
  image_url: string | null
  status: PanelStatus
  is_shared: boolean
  signed_by: string | null
  signed_date: string | null
  validity_months: number | null
  expiry_date: string | null
  date_added_to_hall: string | null
  retired_reason: string | null
  retired_at: string | null
  retired_by: string | null
  created_at: string
}

export interface PanelWithRelations extends Panel {
  buyer: { id: string; name: string } | null
  hall: { id: string; hall_number: number; name: string } | null
}

export interface PanelMovement {
  id: string
  panel_id: string
  from_hall_id: string | null
  destination: string
  destination_hall_id: string | null
  picked_by_name: string
  picked_by_email: string | null
  reason: string
  reason_other: string | null
  purchaser_name: string | null
  supplier_name: string | null
  photo_url: string | null
  signature_url: string | null
  quantity: number | null
  status: MovementStatus
  picked_at: string
  returned_at: string | null
  notes: string | null
  logged_by: string | null
  hop_number: number
}

export interface PanelMovementWithRelations extends PanelMovement {
  panel: { panel_code: string | null; panel_name: string } | null
}

export type ItemType = 'sample' | 'panel'
export type RequestStatus = 'pending' | 'approved' | 'rejected'

export interface SampleComment {
  id: string
  sample_id: string
  author_id: string
  comment: string
  created_at: string
  author?: { full_name: string | null; email: string } | null
}

export interface RecallRequest {
  id: string
  sample_id: string
  requested_by: string
  reason: string | null
  status: 'pending' | 'acknowledged' | 'resolved'
  created_at: string
}

export interface ShiftRequest {
  id: string
  item_type: ItemType
  item_id: string
  from_hall_id: string
  to_hall_id: string
  requested_by: string
  note: string | null
  status: RequestStatus
  admin_note: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export interface ShiftRequestWithRelations extends ShiftRequest {
  from_hall?: { name: string } | null
  to_hall?: { name: string } | null
}

export interface ValidityRequest {
  id: string
  item_type: ItemType
  item_id: string
  requested_by: string
  requested_months: number | null
  requested_expiry_date: string | null
  reason: string | null
  status: RequestStatus
  approved_by: string | null
  approved_at: string | null
  admin_note: string | null
  created_at: string
}

export interface ValidityChange {
  id: string
  item_type: ItemType
  item_id: string
  changed_by: string
  old_expiry_date: string | null
  new_expiry_date: string | null
  reason: string | null
  created_at: string
}

export const REASON_OPTIONS = ['Inspection', 'Production', 'Testing', 'R&D', 'Packaging', 'Other'] as const
export const NON_HALL_DESTINATIONS = ['Supplier', 'Other'] as const
export const PURCHASER_OPTIONS = ['Thanaram', 'Suresh Chaudhary', 'Nitin Jain', 'Other'] as const

export type ValidityStatus = 'valid' | 'expiring_soon' | 'expired' | 'none'

/** Days-remaining threshold for the amber "Expiring Soon" badge — matches
 * the original app's VALIDITY_EXPIRING_SOON_DAYS. */
export const VALIDITY_EXPIRING_SOON_DAYS = 30

export function getValidityStatus(expiryDate: string | null): ValidityStatus {
  if (!expiryDate) return 'none'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86_400_000)
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= VALIDITY_EXPIRING_SOON_DAYS) return 'expiring_soon'
  return 'valid'
}
