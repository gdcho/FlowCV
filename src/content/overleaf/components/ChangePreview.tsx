import { useState } from 'react'
import type { ProposedChange } from '@/types/ai'

// ── Word-level diff ───────────────────────────────────────────────────────────

type DiffToken = { text: string; type: 'equal' | 'delete' | 'insert' }

function diffWords(before: string, after: string): { before: DiffToken[]; after: DiffToken[] } {
  // Tokenize on word/whitespace/punctuation boundaries
  const tokenize = (s: string): string[] => s.match(/\S+|\s+/g) ?? []
  const a = tokenize(before)
  const b = tokenize(after)
  const m = a.length
  const n = b.length

  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])

  // Traceback
  const beforeOut: DiffToken[] = []
  const afterOut: DiffToken[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      beforeOut.unshift({ text: a[i - 1], type: 'equal' })
      afterOut.unshift({ text: b[j - 1], type: 'equal' })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      afterOut.unshift({ text: b[j - 1], type: 'insert' })
      j--
    } else {
      beforeOut.unshift({ text: a[i - 1], type: 'delete' })
      i--
    }
  }
  return { before: beforeOut, after: afterOut }
}

function renderTokens(tokens: DiffToken[], highlight: 'delete' | 'insert') {
  return tokens.map((t, i) =>
    t.type === highlight ? (
      <mark
        key={i}
        style={{
          background: highlight === 'delete' ? '#fca5a5' : '#86efac',
          borderRadius: 2,
          padding: '0 1px',
          color: 'inherit',
        }}
      >
        {t.text}
      </mark>
    ) : (
      <span key={i}>{t.text}</span>
    )
  )
}

// ── Components ────────────────────────────────────────────────────────────────

interface Props {
  changes: ProposedChange[]
  selectedIds: Set<string>
  onToggle: (blockId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export function ChangePreview({ changes, selectedIds, onToggle, onSelectAll, onDeselectAll }: Props) {
  if (changes.length === 0) return null

  const allSelected = changes.every((c) => selectedIds.has(c.blockId))

  return (
    <div className="mx-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Proposed Changes ({changes.length})
        </p>
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-xs text-ov hover:text-ov-dark"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {changes.map((change) => (
          <ChangeCard
            key={change.blockId}
            change={change}
            selected={selectedIds.has(change.blockId)}
            onToggle={() => onToggle(change.blockId)}
          />
        ))}
      </div>
    </div>
  )
}

function ChangeCard({
  change,
  selected,
  onToggle,
}: {
  change: ProposedChange
  selected: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const { before: beforeTokens, after: afterTokens } = diffWords(change.original, change.modified)

  return (
    <div
      className={`rounded-lg border transition-colors ${
        selected ? 'border-ov-light bg-ov-pale' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2 p-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 accent-ov"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800 truncate">
            {change.block?.label ?? change.blockId}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
            {change.reasoning}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-[10px] text-gray-400 hover:text-gray-700 mt-0.5"
        >
          {expanded ? 'Hide diff' : 'Diff'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-2">
          <div className="mb-1.5">
            <p className="text-[10px] font-semibold text-red-600 mb-1">Before</p>
            <pre className="text-[10px] font-mono bg-red-50 border border-red-100 rounded p-1.5 whitespace-pre-wrap break-all text-red-800 max-h-24 overflow-y-auto">
              {renderTokens(beforeTokens, 'delete')}
            </pre>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 mb-1">After</p>
            <pre className="text-[10px] font-mono bg-emerald-50 border border-emerald-100 rounded p-1.5 whitespace-pre-wrap break-all text-emerald-800 max-h-24 overflow-y-auto">
              {renderTokens(afterTokens, 'insert')}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
