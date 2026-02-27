import type { JobContext } from '@/types/job'

interface Props {
  jobContext: JobContext | null
  isLoading: boolean
  onRefresh: () => void
  onClear: () => void
}

export function JobContextPanel({ jobContext, isLoading, onRefresh, onClear }: Props) {
  return (
    <div className="mx-3 mb-3 rounded-lg border border-gray-200 bg-white p-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Description</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh JD from storage"
            className="flex items-center gap-1 text-xs text-ov hover:text-ov-dark disabled:opacity-40"
          >
            {/* Refresh icon */}
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5}
              className={isLoading ? 'animate-spin' : ''}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {jobContext ? (
        <div>
          {/* Title + company */}
          <p className="text-sm font-semibold text-gray-800 truncate">
            {jobContext.title ?? 'Untitled Position'}
          </p>
          {jobContext.company && (
            <p className="text-xs text-gray-500 truncate">{jobContext.company}</p>
          )}

          {/* Summary */}
          {jobContext.summary && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              {jobContext.summary}
            </p>
          )}

          {/* Qualifications */}
          {jobContext.qualifications && jobContext.qualifications.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Qualifications</p>
              <ul className="flex flex-col gap-0.5">
                {jobContext.qualifications.map((q, i) => (
                  <li key={i} className="flex gap-1.5 items-start">
                    <span className="text-ov-mid shrink-0 mt-0.5">›</span>
                    <span className="text-xs text-gray-700 leading-snug">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Keyword chips — capped at 6 */}
          {jobContext.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {jobContext.keywords.slice(0, 6).map((kw) => (
                <span key={kw} className="inline-block px-1.5 py-0.5 rounded bg-ov-pale text-ov-dark text-xs">
                  {kw}
                </span>
              ))}
              {jobContext.keywords.length > 6 && (
                <span className="text-xs text-gray-400 self-center">+{jobContext.keywords.length - 6} more</span>
              )}
            </div>
          )}

          <button onClick={onClear} className="mt-2 text-xs text-red-400 hover:text-red-600">
            Clear JD
          </button>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-xs text-gray-500">No job description captured.</p>
          <p className="text-xs text-gray-400 mt-1">
            Visit a LinkedIn or Indeed job page to capture one.
          </p>
        </div>
      )}
    </div>
  )
}
