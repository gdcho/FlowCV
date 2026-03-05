import type { JobContext } from '@/types/job'

interface Props {
  jobContext: JobContext | null
  isLoading: boolean
  fetchError: string | null
  onRefresh: () => void
  onClear: () => void
}

export function JobContextPanel({ jobContext, isLoading, fetchError, onRefresh, onClear }: Props) {
  return (
    <div className="px-3 py-2">
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

      {fetchError && (
        <p className="text-[10px] text-red-500 mb-1">
          Refresh failed - extension may need a page reload (Cmd+Shift+R).
        </p>
      )}

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

          {/* Keyword chips - capped at 6 */}
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
          <p className="text-xs text-gray-500 mb-2">No job description captured yet.</p>
          <a
            href="https://www.linkedin.com/jobs/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs font-semibold transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#0a66c2">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            Find Jobs on LinkedIn
          </a>
        </div>
      )}
    </div>
  )
}
