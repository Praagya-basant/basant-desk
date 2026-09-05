import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { computeCft, getNowLocalTime, getTodayLocalISO, insertWoodMeasurement } from '../../lib/yaamya/db'
import {
  LOCATIONS,
  SEASONED_SOURCES,
  WOOD_CONDITIONS,
  WOOD_TYPES,
  type NewWoodMeasurement,
} from '../../lib/yaamya/dbTypes'
import {
  playBackspaceClick,
  playClearClick,
  playDigitClick,
  playEndTruckComplete,
  playSaveSuccess,
} from '../../lib/yaamya/sound'
import TodayLog from './TodayLog'

const DIGIT_ROWS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'] as const

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-3.5 py-3 text-base text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors'

type NumField = 'length' | 'width' | 'pieces'

interface Setup {
  location: string
  woodCondition: string
  source: string
  supplierName: string
  batchCode: string
  woodType: string
  billNo: string
  checkerName: string
  heightInches: string
}

function initialSetup(): Setup {
  return {
    location: '',
    woodCondition: '',
    source: '',
    supplierName: '',
    batchCode: '',
    woodType: '',
    billNo: '',
    checkerName: '',
    heightInches: '',
  }
}

function Field({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-text-secondary">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      {children}
    </div>
  )
}

function TapButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[56px] flex-1 rounded-xl border px-4 py-3 text-center text-base font-semibold transition-colors ${
        selected
          ? 'border-accent bg-accent text-white'
          : 'border-border bg-bg text-text hover:border-accent'
      }`}
    >
      {label}
    </button>
  )
}

function Readout({
  label,
  unit,
  value,
  active,
  onSelect,
}: {
  label: string
  unit?: string
  value: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[72px] flex-1 flex-col items-center justify-center rounded-xl border px-2 py-3 transition-colors ${
        active ? 'border-accent bg-accent text-white' : 'border-border bg-bg text-text'
      }`}
    >
      <span
        className={`text-xs font-medium uppercase tracking-wide ${active ? 'text-white/70' : 'text-text-secondary'}`}
      >
        {label}
        {unit ? ` (${unit})` : ''}
      </span>
      <span className="mt-1 text-3xl font-bold tabular-nums">{value || '0'}</span>
    </button>
  )
}

function useAnimatedNumber(target: number, duration = 400): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return undefined

    const start = performance.now()
    let frame: number | null = null

    function step(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (target - from) * eased)
      if (t < 1) {
        frame = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }

    frame = requestAnimationFrame(step)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      fromRef.current = target
    }
  }, [target, duration])

  return display
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg shadow-lg">
        {message}
      </div>
    </div>
  )
}

interface EndSummary {
  billNo: string
  pieces: number
  goodCft: number
  badCft: number
}

function EndTruckOverlay({ summary }: { summary: EndSummary | null }) {
  if (!summary) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/95 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-bg px-6 py-8 text-center shadow-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Truck complete</p>
        <p className="mt-1 text-2xl font-bold text-text">{summary.billNo}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 px-3 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Pieces</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text">{summary.pieces}</p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Total Cft</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text">
              {(summary.goodCft + summary.badCft).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-success">Good Cft</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text">{summary.goodCft.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-red-600">Bad Cft</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text">{summary.badCft.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function WoodInwardForm() {
  const { profile } = useAuth()
  const [setup, setSetup] = useState<Setup>(initialSetup)
  const [truckGoodCft, setTruckGoodCft] = useState(0)
  const [truckBadCft, setTruckBadCft] = useState(0)
  const [pieceCount, setPieceCount] = useState(0)
  const truckTotalCft = truckGoodCft + truckBadCft
  const animatedTruckTotal = useAnimatedNumber(truckTotalCft)

  const [activeField, setActiveField] = useState<NumField>('length')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [pieces, setPieces] = useState('')
  const [quality, setQuality] = useState<'Good' | 'Bad'>('Good')

  const [saveError, setSaveError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [endSummary, setEndSummary] = useState<EndSummary | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const endTruckTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(toastTimeoutRef.current)
      clearTimeout(endTruckTimeoutRef.current)
    },
    [],
  )

  function updateSetup(field: keyof Setup, value: string) {
    setSetup((prev) => ({ ...prev, [field]: value }))
  }

  const isUnseasoned = setup.woodCondition === 'Unseasoned'
  const isSeasoned = setup.woodCondition === 'Seasoned'
  const effectiveSource = isUnseasoned ? 'Outsourced' : setup.source
  const showSupplierName = effectiveSource === 'Outsourced'
  const showBatchCode = effectiveSource === 'Basant Chambers'

  function handleWoodConditionChange(value: string) {
    setSetup((prev) => ({
      ...prev,
      woodCondition: value,
      source: value === 'Unseasoned' ? 'Outsourced' : '',
      supplierName: '',
      batchCode: '',
    }))
  }

  function handleSourceChange(value: string) {
    setSetup((prev) => ({ ...prev, source: value, supplierName: '', batchCode: '' }))
  }

  function resetTruck() {
    setSetup(initialSetup())
    setTruckGoodCft(0)
    setTruckBadCft(0)
    setPieceCount(0)
    setLength('')
    setWidth('')
    setPieces('')
    setQuality('Good')
    setActiveField('length')
    setSaveError(null)
  }

  function handleEndTruck() {
    if (endSummary) return

    playEndTruckComplete()
    setEndSummary({
      billNo: setup.billNo.trim() || '—',
      pieces: pieceCount,
      goodCft: truckGoodCft,
      badCft: truckBadCft,
    })

    endTruckTimeoutRef.current = setTimeout(() => {
      setEndSummary(null)
      resetTruck()
    }, 3000)
  }

  function handleKeypadPress(key: (typeof DIGIT_ROWS)[number]) {
    const setters: Record<NumField, (v: string) => void> = { length: setLength, width: setWidth, pieces: setPieces }
    const values: Record<NumField, string> = { length, width, pieces }
    const setActive = setters[activeField]
    const current = values[activeField]

    if (key === 'back') {
      playBackspaceClick()
      setActive(current.slice(0, -1))
      return
    }
    if (key === '.') {
      if (activeField === 'pieces' || current.includes('.')) return
      playDigitClick()
      setActive(current + '.')
      return
    }
    playDigitClick()
    setActive(current + key)
  }

  function handleClearField() {
    playClearClick()
    const setters: Record<NumField, (v: string) => void> = { length: setLength, width: setWidth, pieces: setPieces }
    setters[activeField]('')
  }

  const heightIn = parseFloat(setup.heightInches) || 0
  const lengthFt = parseFloat(length) || 0
  const widthIn = parseFloat(width) || 0
  const piecesNum = parseInt(pieces, 10) || 0
  const liveCft = computeCft(lengthFt, widthIn, heightIn, piecesNum)

  function handleSavePiece() {
    setSaveError(null)

    if (!setup.location || !setup.woodCondition || !setup.woodType) {
      setSaveError('Complete truck setup: location, condition and wood type.')
      return
    }
    if (!setup.billNo.trim() || !setup.checkerName.trim() || !setup.heightInches) {
      setSaveError('Bill No, Checker Name and Height are required.')
      return
    }
    if (showSupplierName && !setup.supplierName.trim()) {
      setSaveError('Supplier Name is required.')
      return
    }
    if (showBatchCode && !setup.batchCode.trim()) {
      setSaveError('Batch Code is required.')
      return
    }

    const lengthNum = parseFloat(length)
    const widthNum = parseFloat(width)
    const piecesInt = parseInt(pieces, 10)

    if (isNaN(lengthNum) || lengthNum <= 0) {
      setSaveError('Enter a valid length.')
      return
    }
    if (isNaN(widthNum) || widthNum <= 0) {
      setSaveError('Enter a valid width.')
      return
    }
    if (isNaN(piecesInt) || piecesInt <= 0) {
      setSaveError('Enter valid pieces.')
      return
    }

    const cft = computeCft(lengthNum, widthNum, heightIn, piecesInt)

    const payload: NewWoodMeasurement = {
      entry_date: getTodayLocalISO(),
      entry_time: getNowLocalTime(),
      location: setup.location,
      wood_type: setup.woodType,
      wood_condition: setup.woodCondition,
      source: effectiveSource || null,
      supplier_name: showSupplierName ? setup.supplierName.trim() : null,
      batch_code: showBatchCode ? setup.batchCode.trim() : null,
      bill_no: setup.billNo.trim(),
      checker_name: setup.checkerName.trim(),
      height_inches: heightIn,
      length_ft: lengthNum,
      width_inches: widthNum,
      pieces: piecesInt,
      total_cft: Number(cft.toFixed(4)),
      quality,
      user_id: profile?.id ?? null,
    }

    // Optimistic: reset instantly for the next plank, fire the insert in the
    // background. A slow/failed insert never blocks the next measurement.
    if (quality === 'Good') setTruckGoodCft((g) => g + cft)
    else setTruckBadCft((b) => b + cft)
    setPieceCount((c) => c + 1)
    setLength('')
    setWidth('')
    setPieces('')
    setActiveField('length')
    setFlash(true)
    setTimeout(() => setFlash(false), 500)

    playSaveSuccess()
    setToast(`Piece saved — ${cft.toFixed(2)} Cft`)
    clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 1600)

    insertWoodMeasurement(payload).catch((err: unknown) => {
      setSaveError(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    })
  }

  return (
    <div className="space-y-6">
      <Toast message={toast} />
      <EndTruckOverlay summary={endSummary} />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Location</p>
        <div className="flex gap-3">
          {LOCATIONS.map((loc) => (
            <TapButton
              key={loc}
              label={loc}
              selected={setup.location === loc}
              onClick={() => updateSetup('location', loc)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Wood condition</p>
        <div className="flex gap-3">
          {WOOD_CONDITIONS.map((c) => (
            <TapButton
              key={c}
              label={c}
              selected={setup.woodCondition === c}
              onClick={() => handleWoodConditionChange(c)}
            />
          ))}
        </div>
      </div>

      {isSeasoned && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Source</p>
          <div className="flex gap-3">
            {SEASONED_SOURCES.map((s) => (
              <TapButton
                key={s}
                label={s}
                selected={setup.source === s}
                onClick={() => handleSourceChange(s)}
              />
            ))}
          </div>
        </div>
      )}

      {isUnseasoned && (
        <div className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-secondary">
          Source: Outsourced (auto — unseasoned wood)
        </div>
      )}

      {showSupplierName && (
        <Field label="Supplier Name" required htmlFor="supplierName">
          <input
            id="supplierName"
            type="text"
            value={setup.supplierName}
            onChange={(e) => updateSetup('supplierName', e.target.value)}
            className={inputClass}
          />
        </Field>
      )}

      {showBatchCode && (
        <Field label="Batch Code" required htmlFor="batchCode">
          <input
            id="batchCode"
            type="text"
            value={setup.batchCode}
            onChange={(e) => updateSetup('batchCode', e.target.value)}
            className={inputClass}
          />
        </Field>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Wood type</p>
        <div className="grid grid-cols-3 gap-2">
          {WOOD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateSetup('woodType', type)}
              className={`min-h-[56px] rounded-xl border px-2 py-3 text-center text-sm font-semibold transition-colors ${
                setup.woodType === type
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-bg text-text hover:border-accent'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <Field label="Bill No" required htmlFor="billNo">
        <input
          id="billNo"
          type="text"
          value={setup.billNo}
          onChange={(e) => updateSetup('billNo', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Checker Name" required htmlFor="checkerName">
        <input
          id="checkerName"
          type="text"
          value={setup.checkerName}
          onChange={(e) => updateSetup('checkerName', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Height / Thickness (in)" required htmlFor="heightInches">
        <input
          id="heightInches"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={setup.heightInches}
          onChange={(e) => updateSetup('heightInches', e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
        <span className="text-sm font-medium text-text-secondary">
          {pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'} this truck
        </span>
        <span className="text-lg font-bold tabular-nums text-accent">
          {animatedTruckTotal.toFixed(2)} <span className="text-sm font-normal text-text-secondary">Cft</span>
        </span>
      </div>

      <div className="flex gap-2">
        <Readout
          label="Length"
          unit="ft"
          value={length}
          active={activeField === 'length'}
          onSelect={() => setActiveField('length')}
        />
        <Readout
          label="Width"
          unit="in"
          value={width}
          active={activeField === 'width'}
          onSelect={() => setActiveField('width')}
        />
        <Readout
          label="Pieces"
          value={pieces}
          active={activeField === 'pieces'}
          onSelect={() => setActiveField('pieces')}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setQuality('Good')}
          className={`min-h-[48px] flex-1 rounded-xl border text-base font-semibold transition-colors ${
            quality === 'Good' ? 'border-accent bg-accent text-white' : 'border-border bg-bg text-text'
          }`}
        >
          Good
        </button>
        <button
          type="button"
          onClick={() => setQuality('Bad')}
          className={`min-h-[48px] flex-1 rounded-xl border text-base font-semibold transition-colors ${
            quality === 'Bad' ? 'border-red-600 bg-red-600 text-white' : 'border-border bg-bg text-text'
          }`}
        >
          Bad
        </button>
      </div>

      <div
        className={`flex items-center justify-center rounded-xl border py-4 transition-colors ${
          flash ? 'border-success bg-success/10' : 'border-border bg-bg'
        }`}
      >
        <span className="text-4xl font-bold tabular-nums text-text">{liveCft.toFixed(2)}</span>
        <span className="ml-2 text-lg text-text-secondary">Cft</span>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Keypad — {activeField}</p>
        <button
          type="button"
          onClick={handleClearField}
          className="text-xs font-medium text-text-secondary underline underline-offset-2 hover:text-text"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {DIGIT_ROWS.map((key, i) => (
          <button
            key={`${key}-${i}`}
            type="button"
            onClick={() => handleKeypadPress(key)}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-bg text-xl font-semibold text-text transition-colors active:bg-surface-2"
          >
            {key === 'back' ? '⌫' : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSavePiece}
        className="min-h-[56px] w-full rounded-xl bg-accent text-lg font-bold text-white transition-colors hover:bg-accent-hover active:scale-[0.99]"
      >
        SAVE PIECE
      </button>

      <button
        type="button"
        onClick={handleEndTruck}
        className="min-h-[48px] w-full rounded-xl border border-red-300 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
      >
        END TRUCK
      </button>
    </div>
  )
}

export default function WoodInward() {
  const [tab, setTab] = useState<'entry' | 'log'>('entry')

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-lg font-medium text-text">Wood Inward</h1>

      <div className="mb-6 flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab('entry')}
          className={`min-h-[44px] flex-1 text-sm font-semibold transition-colors ${
            tab === 'entry' ? 'border-b-2 border-accent text-text' : 'text-text-secondary hover:text-text'
          }`}
        >
          Entry
        </button>
        <button
          type="button"
          onClick={() => setTab('log')}
          className={`min-h-[44px] flex-1 text-sm font-semibold transition-colors ${
            tab === 'log' ? 'border-b-2 border-accent text-text' : 'text-text-secondary hover:text-text'
          }`}
        >
          Today's Log
        </button>
      </div>

      {tab === 'entry' ? <WoodInwardForm /> : <TodayLog />}
    </div>
  )
}
