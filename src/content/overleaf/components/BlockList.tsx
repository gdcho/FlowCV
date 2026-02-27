import type { LaTeXBlock } from '@/types/latex'

interface Props {
  blocks: LaTeXBlock[]
}

const TYPE_COLORS: Record<string, string> = {
  section: 'bg-purple-100 text-purple-700',
  subsection: 'bg-violet-100 text-violet-700',
  resumeSubheading: 'bg-blue-100 text-blue-700',
  resumeProjectHeading: 'bg-cyan-100 text-cyan-700',
  resumeItem: 'bg-gray-100 text-gray-600',
  environment: 'bg-amber-100 text-amber-700',
  default: 'bg-gray-100 text-gray-600',
}

export function BlockList({ blocks }: Props) {
  if (blocks.length === 0) {
    return (
      <div className="mx-3 mb-3 rounded-lg border border-dashed border-gray-200 p-4 text-center">
        <p className="text-xs text-gray-400">No LaTeX blocks parsed yet.</p>
        <p className="text-xs text-gray-400 mt-1">Click Analyze to parse your resume.</p>
      </div>
    )
  }

  return (
    <div className="mx-3 mb-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Parsed Blocks ({blocks.length})
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="flex items-center gap-2 rounded-md bg-gray-50 border border-gray-100 px-2 py-1.5"
          >
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${TYPE_COLORS[block.type] ?? TYPE_COLORS.default}`}
            >
              {block.type}
            </span>
            <span className="text-xs text-gray-700 truncate">{block.label}</span>
            <span className="ml-auto text-[10px] text-gray-400 shrink-0">
              L{block.range.startLine}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
