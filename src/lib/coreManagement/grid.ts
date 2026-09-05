/** Scratch Sheet's grid model — stored as JSON inside the existing
 * scratch_sheets.content text column, so no schema change is needed. A
 * genuine lightweight in-app grid (add/remove rows & columns, editable
 * cells), not a spreadsheet engine — no formulas, no cell references. */
export interface GridData {
  rows: number
  cols: number
  cells: Record<string, string>
}

export function emptyGrid(rows = 10, cols = 6): GridData {
  return { rows, cols, cells: {} }
}

export function cellKey(r: number, c: number): string {
  return `${r}:${c}`
}

export function parseGrid(content: string): GridData {
  if (!content?.trim()) return emptyGrid()
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && typeof parsed.rows === 'number' && typeof parsed.cols === 'number') {
      return { rows: parsed.rows, cols: parsed.cols, cells: parsed.cells ?? {} }
    }
  } catch {
    // Not JSON — likely a sheet saved by the earlier plain-textarea build.
    // Preserve it by dropping the old text into the first cell rather than
    // silently discarding it.
    const grid = emptyGrid()
    grid.cells[cellKey(0, 0)] = content
    return grid
  }
  return emptyGrid()
}

export function serializeGrid(grid: GridData): string {
  return JSON.stringify(grid)
}

export function colLabel(c: number): string {
  let label = ''
  let n = c
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}
