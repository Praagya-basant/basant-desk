import { useEffect, useState } from 'react'
import { X, ImageOff } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../../lib/access'
import {
  addSampleComment,
  getOpenMovement,
  listMovementsForSample,
  listSampleComments,
  listValidityChanges,
  returnSample,
} from '../../../lib/mcsp/db'
import type { Movement, SampleComment, SampleWithRelations, ValidityChange } from '../../../lib/mcsp/dbTypes'
import { StatusBadge, ValidityBadge } from '../Badges'
import IssueSampleModal from './IssueSampleModal'
import ReturnConfirmModal from './ReturnConfirmModal'
import RaiseRecallModal from './RaiseRecallModal'
import ManageValidityModal from '../ManageValidityModal'
import RaiseShiftRequestModal from '../RaiseShiftRequestModal'

type Tab = 'details' | 'history' | 'comments'

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm text-text text-right">{value || '—'}</span>
    </div>
  )
}

export default function SampleDrawer({
  sample,
  onClose,
  onChanged,
}: {
  sample: SampleWithRelations
  onClose: () => void
  onChanged: () => void
}) {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'sales') || profile?.role === 'manager'
  const canManageValidity = isAdminOrDeptAdmin(profile, 'sales')
  const isMerchant = profile?.role === 'merchant'

  const [tab, setTab] = useState<Tab>('details')
  const [movements, setMovements] = useState<Movement[]>([])
  const [comments, setComments] = useState<SampleComment[]>([])
  const [validityHistory, setValidityHistory] = useState<ValidityChange[]>([])
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [returning, setReturning] = useState(false)
  const [recalling, setRecalling] = useState(false)
  const [managingValidity, setManagingValidity] = useState(false)
  const [raisingShift, setRaisingShift] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMovementsForSample(sample.id).then(setMovements).catch(() => {})
    listSampleComments(sample.id).then(setComments).catch(() => {})
    listValidityChanges('sample', sample.id).then(setValidityHistory).catch(() => {})
  }, [sample.id])

  async function handleAddComment() {
    if (!newComment.trim() || !profile) return
    setPosting(true)
    try {
      await addSampleComment(sample.id, profile.id, newComment.trim())
      setNewComment('')
      setComments(await listSampleComments(sample.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add comment.')
    } finally {
      setPosting(false)
    }
  }

  async function handleQuickReturn(photoUrl?: string) {
    setError(null)
    try {
      const movement = await getOpenMovement(sample.id)
      if (!movement) throw new Error('No open movement found for this sample.')
      await returnSample(movement.id, photoUrl)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not return this sample.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-[480px] h-full bg-bg border-l border-border shadow-sm flex flex-col overflow-hidden">
        {/* Hero */}
        <div className="shrink-0 border-b border-border">
          <div className="h-44 bg-surface-2 flex items-center justify-center overflow-hidden">
            {sample.image_url ? (
              <img src={sample.image_url} alt={sample.product_name} className="w-full h-full object-cover" />
            ) : (
              <ImageOff size={28} strokeWidth={1.5} className="text-text-muted" />
            )}
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-medium text-text">{sample.product_name}</p>
                <p className="text-sm text-text-secondary font-mono mt-0.5">{sample.bt_code}</p>
              </div>
              <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary">{sample.buyer?.name ?? '—'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary">{sample.hall?.name ?? '—'}</span>
              <StatusBadge status={sample.status} />
              <ValidityBadge expiryDate={sample.expiry_date} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex gap-1 px-5 pt-3 border-b border-border">
          {(['details', 'history', 'comments'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-accent text-text font-medium' : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              {t === 'history' ? 'Movement History' : t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {tab === 'details' && (
            <div>
              <Row label="BT Code" value={sample.bt_code} />
              <Row label="Product Ref" value={sample.product_ref} />
              <Row label="Collection" value={sample.collection_name} />
              <Row label="Signed By" value={sample.signed_by} />
              <Row label="Signed Date" value={sample.signed_date} />
              <Row label="Validity (months)" value={sample.validity_months?.toString()} />
              <Row label="Expiry Date" value={sample.expiry_date} />
              <Row label="Hall" value={sample.hall?.name} />
              <Row label="Buyer" value={sample.buyer?.name} />

              {validityHistory.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-2">Validity History</p>
                  <div className="space-y-2">
                    {validityHistory.map((v) => (
                      <div key={v.id} className="text-sm border border-border rounded-md px-3 py-2">
                        <p className="text-text">
                          {v.old_expiry_date ?? '—'} → {v.new_expiry_date ?? '—'}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">{v.reason}</p>
                        <p className="text-xs text-text-muted mt-0.5">{new Date(v.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4">
              {movements.length === 0 ? (
                <p className="text-sm text-text-secondary">No movements yet.</p>
              ) : (
                movements.map((m) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${m.status === 'out' ? 'bg-amber-500' : 'bg-green-500'}`} />
                      <span className="w-px flex-1 bg-border mt-1" />
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                      <p className="text-sm font-medium text-text">{m.status === 'out' ? 'Issued' : 'Returned'}</p>
                      <p className="text-xs text-text-muted mt-0.5">{new Date(m.picked_at).toLocaleString()}</p>
                      <p className="text-sm text-text-secondary mt-1">To: {m.picked_by_name}</p>
                      <p className="text-sm text-text-secondary">Destination: {m.destination}</p>
                      <p className="text-sm text-text-secondary">Reason: {m.reason_other || m.reason}</p>
                      {m.photo_url && (
                        <img src={m.photo_url} alt="" className="mt-2 w-20 h-20 object-cover rounded-md border border-border" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div>
              <div className="space-y-3 mb-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-text-secondary">No comments yet.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="text-sm">
                      <p className="text-text">{c.comment}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {c.author?.full_name || c.author?.email || 'Unknown'} · {new Date(c.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={handleAddComment}
                  disabled={posting || !newComment.trim()}
                  className="rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border p-4 flex flex-wrap gap-2">
          {sample.status === 'in_hall' && canManage && (
            <button
              onClick={() => setIssuing(true)}
              className="rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover transition-colors"
            >
              Issue Sample
            </button>
          )}
          {sample.status === 'checked_out' && canManage && (
            <button
              onClick={() => setReturning(true)}
              className="rounded-md border border-border text-text text-sm font-medium px-3 py-2 hover:bg-surface transition-colors"
            >
              Return
            </button>
          )}
          {isMerchant && (
            <button
              onClick={() => setRecalling(true)}
              className="rounded-md border border-border text-text text-sm font-medium px-3 py-2 hover:bg-surface transition-colors"
            >
              Raise Recall
            </button>
          )}
          {canManageValidity ? (
            <button
              onClick={() => setManagingValidity(true)}
              className="rounded-md border border-border text-text text-sm font-medium px-3 py-2 hover:bg-surface transition-colors"
            >
              Manage Validity
            </button>
          ) : (
            <button
              onClick={() => setManagingValidity(true)}
              className="rounded-md border border-border text-text text-sm font-medium px-3 py-2 hover:bg-surface transition-colors"
            >
              Request Extension
            </button>
          )}
          {sample.status === 'in_hall' && (canManage || isMerchant) && (
            <button
              onClick={() => setRaisingShift(true)}
              className="rounded-md border border-border text-text text-sm font-medium px-3 py-2 hover:bg-surface transition-colors"
            >
              Raise Shift Request
            </button>
          )}
        </div>
      </div>

      {issuing && (
        <IssueSampleModal
          sample={sample}
          onClose={() => setIssuing(false)}
          onSaved={() => {
            setIssuing(false)
            onChanged()
          }}
        />
      )}
      {returning && (
        <ReturnConfirmModal
          onClose={() => setReturning(false)}
          onConfirm={async (photoUrl) => {
            await handleQuickReturn(photoUrl)
            setReturning(false)
          }}
        />
      )}
      {recalling && (
        <RaiseRecallModal
          sampleId={sample.id}
          onClose={() => setRecalling(false)}
          onSaved={() => setRecalling(false)}
        />
      )}
      {managingValidity && (
        <ManageValidityModal
          itemType="sample"
          itemId={sample.id}
          currentExpiry={sample.expiry_date}
          isAdmin={canManageValidity}
          onClose={() => setManagingValidity(false)}
          onSaved={() => {
            setManagingValidity(false)
            onChanged()
          }}
        />
      )}
      {raisingShift && (
        <RaiseShiftRequestModal
          itemType="sample"
          itemId={sample.id}
          currentHallId={sample.hall_id}
          onClose={() => setRaisingShift(false)}
          onSaved={() => setRaisingShift(false)}
        />
      )}
    </div>
  )
}
