import { useEffect, useMemo, useRef, useState } from 'react'
import { formatShortDate } from '../../lib/coreManagement/taskHelpers'

/** These are pure editing widgets now — no "click to reveal, click away to
 * hide" state of their own. TaskTable owns that: a cell is either showing
 * its plain display value (rendered separately, see renderRichText below)
 * or one of these is mounted because TaskTable put it into "editing" for
 * that cell. That split is what makes single-click-selects /
 * double-click-or-Enter-edits possible — with the old design each control
 * decided for itself when to become interactive, which had no way to
 * represent "selected but not editing" at all. */

const editorClass =
  'w-full bg-bg border border-accent rounded px-1.5 py-1 text-sm text-text outline-none transition-colors'

/** Toggles a markdown-style formatting wrapper (`**bold**` or `*italic*`)
 * around the current text selection — or, with nothing selected, inserts an
 * empty pair and places the cursor between them. Same interaction as
 * GitHub/Sheets' in-cell Ctrl+B. Storing the markers as literal text and
 * parsing them back at render time (renderRichText below) is what makes
 * formatting work in a plain <textarea> and actually persist with the saved
 * text, no schema change needed. Known limitation, not fixed: applying
 * italic to a selection that's already fully **bold** (or vice versa) can
 * misdetect "already wrapped" since a bold span's edges also technically
 * start/end with a single `*` — an edge case combined bold+italic wasn't
 * asked for and isn't worth a full markup parser for. */
export function applyFormat(el: HTMLTextAreaElement, value: string, setValue: (v: string) => void, marker: '**' | '*') {
  const { selectionStart, selectionEnd } = el
  const selected = value.slice(selectionStart, selectionEnd)
  const m = marker.length
  const alreadyWrapped = selected.length >= m * 2 && selected.startsWith(marker) && selected.endsWith(marker)

  let nextValue: string
  let nextStart: number
  let nextEnd: number

  if (selectionStart === selectionEnd) {
    nextValue = value.slice(0, selectionStart) + marker + marker + value.slice(selectionEnd)
    nextStart = nextEnd = selectionStart + m
  } else if (alreadyWrapped) {
    const unwrapped = selected.slice(m, -m)
    nextValue = value.slice(0, selectionStart) + unwrapped + value.slice(selectionEnd)
    nextStart = selectionStart
    nextEnd = selectionStart + unwrapped.length
  } else {
    nextValue = value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd)
    nextStart = selectionStart
    nextEnd = selectionEnd + m * 2
  }

  setValue(nextValue)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(nextStart, nextEnd)
  })
}

/** Splits on **bold** and *italic* markers and renders them as <strong>/
 * <em> — the read-side counterpart to applyFormat above. Used both for the
 * remarks timeline and for Task/Remarks cells' plain-display (non-editing)
 * state, so formatting applied in one place is visible everywhere that text
 * shows up, not just in the edit box. */
export function renderRichText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) return <em key={i}>{part.slice(1, -1)}</em>
    return <span key={i}>{part}</span>
  })
}

export function TextEditor({
  value,
  onChange,
  onKeyDown,
  align,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <input
      type="text"
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      className={`${editorClass} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}
    />
  )
}

/** Wrapping, auto-growing multi-line editor — used for Task/Remarks so full
 * content is visible instead of being clipped. Height tracks content via
 * scrollHeight, recalculated both on text change and via a ResizeObserver on
 * the element itself (the column's *width* can change independently of the
 * text — toggling other columns, a web font finishing its async load —
 * without the observer that left stale, too-short heights with the
 * remaining text silently clipped). Ctrl/Cmd+B and Ctrl/Cmd+I apply
 * formatting to the current selection; Enter/Shift+Enter/Tab/Escape are
 * handled by the caller via onKeyDown (TaskTable's shared editing-key logic
 * — this component doesn't decide navigation, only text editing). */
export function TextareaEditor({
  value,
  onChange,
  onKeyDown,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = ref.current
    if (!el) return
    const prevHeight = el.style.height
    el.style.height = 'auto'
    const next = `${el.scrollHeight}px`
    if (next !== prevHeight) el.style.height = next
    else el.style.height = prevHeight
  }

  useEffect(() => {
    resize()
  }, [value])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => resize())
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <textarea
      ref={ref}
      autoFocus
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
          e.preventDefault()
          if (ref.current) applyFormat(ref.current, value, onChange, '**')
          return
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
          e.preventDefault()
          if (ref.current) applyFormat(ref.current, value, onChange, '*')
          return
        }
        onKeyDown(e)
      }}
      className={`${editorClass} resize-none overflow-hidden leading-snug py-1`}
    />
  )
}

export function DateEditor({
  value,
  onChange,
  onKeyDown,
}: {
  value: string | null
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <input
      type="date"
      autoFocus
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${editorClass} text-right`}
    />
  )
}

export function SelectEditor({
  value,
  options,
  onChange,
  onKeyDown,
  align,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLSelectElement>) => void
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <select
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${editorClass} cursor-pointer ${align === 'center' ? 'text-center' : ''}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Searchable typeahead — type to filter, arrow keys + Enter to select,
 * click a match, Escape to cancel. Used for Responsible, where the option
 * list can be long enough that a plain <select> is slow to scan. */
export function ComboboxEditor({
  value,
  options,
  onSelect,
  onCancel,
}: {
  value: string
  options: { value: string; label: string }[]
  onSelect: (value: string) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const current = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onCancel()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (filtered[highlight]) onSelect(filtered[highlight].value)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={current?.label ?? 'Search…'}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlight(0)
        }}
        onKeyDown={onKeyDown}
        className={editorClass}
      />
      {filtered.length > 0 && (
        <ul className="absolute left-0 top-full mt-0.5 w-48 max-h-52 overflow-y-auto rounded-md border border-border bg-bg shadow-sm z-50 py-1">
          {filtered.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(o.value)}
                className={`w-full text-left px-2.5 py-1.5 text-sm truncate transition-colors ${
                  i === highlight ? 'bg-accent/10 text-text' : 'text-text hover:bg-surface-2'
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Plain-text formatter for a cell's non-editing display value — every
 * column except Task/Remarks (which need renderRichText for bold/italic,
 * handled by the caller since it returns nodes, not text). */
export function formatDisplayDate(value: string | null): string {
  return formatShortDate(value)
}
