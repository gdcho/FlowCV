import { useState } from 'react'
import type { ProposedChange } from '@/types/ai'

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
              {change.original}
            </pre>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 mb-1">After</p>
            <pre className="text-[10px] font-mono bg-emerald-50 border border-emerald-100 rounded p-1.5 whitespace-pre-wrap break-all text-emerald-800 max-h-24 overflow-y-auto">
              {change.modified}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
