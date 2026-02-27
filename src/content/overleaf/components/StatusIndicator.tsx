import type { AnalysisStatus } from '@/store/sidebar-store'

interface Props {
  status: AnalysisStatus
  errorMessage: string | null
  streamingText: string
}

export function StatusIndicator({ status, errorMessage, streamingText }: Props) {
  if (status === 'idle') return null

  if (status === 'error') {
    return (
      <div className="mx-3 mb-3 rounded-lg bg-red-50 border border-red-200 p-3">
        <p className="text-xs font-semibold text-red-700 mb-1">Error</p>
        <p className="text-xs text-red-600">{errorMessage}</p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-ov-pale border border-ov-light p-3">
        <Spinner />
        <p className="text-xs text-ov-dark">Analyzing resume blocks…</p>
      </div>
    )
  }

  if (status === 'streaming') {
    return (
      <div className="mx-3 mb-3 rounded-lg bg-ov-pale border border-ov-light p-3">
        <div className="flex items-center gap-2 mb-2">
          <Spinner />
          <p className="text-xs font-semibold text-ov-dark">Claude is writing…</p>
        </div>
        <p className="text-xs text-ov font-mono whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">
          {streamingText.slice(-400)}
        </p>
      </div>
    )
  }

  if (status === 'complete') {
    return (
      <div className="mx-3 mb-3 rounded-lg bg-ov-pale border border-ov-light p-2">
        <p className="text-xs text-ov-dark font-semibold">Analysis complete — review changes below.</p>
      </div>
    )
  }

  if (status === 'applied') {
    return (
      <div className="mx-3 mb-3 rounded-lg bg-ov-pale border border-ov-light p-2">
        <p className="text-xs text-ov-dark font-semibold">Changes applied to your document.</p>
      </div>
    )
  }

  return null
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5 text-ov" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
