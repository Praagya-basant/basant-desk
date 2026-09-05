import { useEffect, useState } from 'react'
import { X, ImageOff } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { isAdminOrDeptAdmin } from '../../../lib/access'
import { getOpenPanelMovement, listPanelMovementsForPanel, listValidityChanges, returnPanel } from '../../../lib/mcsp/db'
import type { PanelMovement, PanelWithRelations, ValidityChange } from '../../../lib/mcsp/dbTypes'
import { StatusBadge, ValidityBadge } from '../Badges'
import IssuePanelModal from './IssuePanelModal'
import RetirePanelModal from './RetirePanelModal'
import ReturnConfirmModal from '../mcs/ReturnConfirmModal'
import ManageValidityModal from '../ManageValidityModal'
import RaiseShiftRequestModal from '../RaiseShiftRequestModal'

type Tab = 'details' | 'history'

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm text-text text-right">{value || '—'}</span>
    </div>
  )
}

export default function PanelDrawer({
  panel,
  onClose,
  onChanged,
}: {
  panel: PanelWithRelations
  onClose: () => void
  onChanged: () => void
}) {
  const { profile } = useAuth()
  const canManage = isAdminOrDeptAdmin(profile, 'sales') || profile?.role === 'manager'
  const isAdmin = isAdminOrDeptAdmin(profile, 'sales')

  const [tab, setTab] = useState<Tab>('details')
  const [movements, setMovements] = useState<PanelMovement[]>([])
  const [validityHistory, setValidityHistory] = useState<ValidityChange[]>([])
  const [issuing, setIssuing] = useState(false)
  const [returning, setReturning] = useState(false)
  const [retiring, setRetiring] = useState(false)
  const [managingValidity, setManagingValidity] = useState(false)
  const [raisingShift, setRaisingShift] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPanelMovementsForPanel(panel.id).then(setMovements).catch(() => {})
    listValidityChanges('panel', panel.id).then(setValidityHistory).catch(() => {})
  }, [panel.id])

  async function handleQuickReturn(photoUrl?: string) {
    setError(null)
    try {
      const movement = await getOpenPanelMovement(panel.id)
      if (!movement) throw new Error('No open movement found for this panel.')
      await returnPanel(movement.id, photoUrl)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not return this panel.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-[480px] h-full bg-bg border-l border-border shadow-sm flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border">
          <div className="h-44 bg-surface-2 flex items-center justify-center overflow-hidden">
            {panel.image_url ? (
              <img src={panel.image_url} alt={panel.panel_name} className="w-full h-full object-cover" />
            ) : (
              <ImageOff size={28} strokeWidth={1.5} className="text-text-muted" />
            )}
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-medium text-text">{panel.panel_name}</p>
                <p className="text-sm text-text-secondary font-mono mt-0.5">{panel.panel_code ?? '—'}</p>
              </div>
              <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary">{panel.buyer?.name ?? '—'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary">{panel.hall?.name ?? '—'}</span>
              {panel.is_shared && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Shared</span>}
              <StatusBadge status={panel.status} />
              <ValidityBadge expiryDate={panel.expiry_date} />
            </div>
          </div>
        </div>

        <div className="shrink-0 flex gap-1 px-5 pt-3 border-b border-border">
          {(['details', 'history'] as Tab[]).map((t) => (
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {tab === 'details' && (
            <div>
              <Row label="Panel Code" value={panel.panel_code} />
              <Row label="Panel Ref" value={panel.panel_ref} />
              <Row label="Finish" value={panel.panel_finish} />
              <Row label="Finish Recipe" value={panel.finish_recipe} />
              <Row label="Collection" value={panel.collection_name} />
              <Row label="Signed By" value={panel.signed_by} />
              <Row label="Signed Date" value={panel.signed_date} />
              <Row label="Expiry Date" value={panel.expiry_date} />
              <Row label="Hall" value={panel.hall?.name} />
              <Row label="Buyer" value={panel.buyer?.name} />
              {panel.status === 'retired' && <Row label="Retired Reason" value={panel.retired_reason} />}

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
                      {m.quantity != null && <p className="text-sm text-text-secondary">Quantity: {m.quantity}</p>}
                      {m.photo_url && <img src={m.photo_url} alt="" className="mt-2 w-20 h-20 object-cover rounded-md border border-border" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-4 flex flex-wrap gap-2">
          {panel.status === 'in_hall' && canManage && (
            <button onClick={() => setIssuing(true)} className="rounded-md bg-accent text-white text-sm font-medium px-3 py-2 hover:bg-accent-hover transition-colors">
              Issue Panel
            </button>
          )}
          {panel.status === 'issued' && canManage && (
            <button onClick={() => setReturning(true)} className="rounded-md border border-border text-text text-sm font-medium px-3 py-2 hover:bg-surface transition-colors">
              Return
            </button>
          )}
          {panel.status !== 'retired' && panel.status !== 'issued' && isAdmin && (
            <button onClick={() => setRetiring(true)} className="rounded-md border border-red-300 text-red-600 text-sm font-medium px-3 py-2 hover:bg-red-50 transition-colors">
              Retire
            </button>
          )}
          {panel.status !== 'retired' && (
            <button onClick={() => setManagingValidity(true)} className="rounded-md border border-border text-text text-sm font-medium px-3 py-2 hover:bg-surface transition-colors">
              {isAdmin ? 'Manage Validity' : 'Request Extension'}
            </button>
          )}
          {panel.status === 'in_hall' && (
            <button onClick={() => setRaisingShift(true)} className="rounded-md border border-border text-text text-sm font-medium px-3 py-2 hover:bg-surface transition-colors">
              Raise Shift Request
            </button>
          )}
        </div>
      </div>

      {issuing && (
        <IssuePanelModal
          panel={panel}
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
      {retiring && (
        <RetirePanelModal
          panelId={panel.id}
          onClose={() => setRetiring(false)}
          onSaved={() => {
            setRetiring(false)
            onChanged()
          }}
        />
      )}
      {managingValidity && (
        <ManageValidityModal
          itemType="panel"
          itemId={panel.id}
          currentExpiry={panel.expiry_date}
          isAdmin={isAdmin}
          onClose={() => setManagingValidity(false)}
          onSaved={() => {
            setManagingValidity(false)
            onChanged()
          }}
        />
      )}
      {raisingShift && (
        <RaiseShiftRequestModal
          itemType="panel"
          itemId={panel.id}
          currentHallId={panel.hall_id}
          onClose={() => setRaisingShift(false)}
          onSaved={() => setRaisingShift(false)}
        />
      )}
    </div>
  )
}
