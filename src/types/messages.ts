import type { LaTeXBlock } from './latex'
import type { JobContext } from './job'
import type { ProposedChange } from './ai'
import type { AppSettings } from './storage'

export type { AppSettings } from './storage'

// ─── Monaco Bridge Messages (window.postMessage) ─────────────────────────────

export const BRIDGE_SOURCE = 'LATEX_FLOW_BRIDGE' as const
export const CONTENT_SOURCE = 'LATEX_FLOW_CONTENT' as const

export type BridgeMessageType =
  | 'LATEX_FLOW_GET_CONTENT'
  | 'LATEX_FLOW_CONTENT_RESPONSE'
  | 'LATEX_FLOW_CONTENT_CHANGE'
  | 'LATEX_FLOW_APPLY_CHANGES'
  | 'LATEX_FLOW_APPLY_DONE'
  | 'LATEX_FLOW_BRIDGE_READY'

export interface BridgeMessageBase {
  source: typeof BRIDGE_SOURCE | typeof CONTENT_SOURCE
  type: BridgeMessageType
  requestId?: string
}

export interface GetContentRequest extends BridgeMessageBase {
  source: typeof CONTENT_SOURCE
  type: 'LATEX_FLOW_GET_CONTENT'
}

export interface GetContentResponse extends BridgeMessageBase {
  source: typeof BRIDGE_SOURCE
  type: 'LATEX_FLOW_CONTENT_RESPONSE'
  payload: { content: string; modelUri: string }
}

export interface ContentChangeEvent extends BridgeMessageBase {
  source: typeof BRIDGE_SOURCE
  type: 'LATEX_FLOW_CONTENT_CHANGE'
  payload: { content: string } | null
}

export interface ApplyChangesRequest extends BridgeMessageBase {
  source: typeof CONTENT_SOURCE
  type: 'LATEX_FLOW_APPLY_CHANGES'
  payload: { changes: Array<{ original: string; modified: string }> }
}

export interface ApplyDoneEvent extends BridgeMessageBase {
  source: typeof BRIDGE_SOURCE
  type: 'LATEX_FLOW_APPLY_DONE'
  payload: { appliedCount: number }
}

export interface BridgeReadyEvent extends BridgeMessageBase {
  source: typeof BRIDGE_SOURCE
  type: 'LATEX_FLOW_BRIDGE_READY'
}

export type BridgeMessage =
  | GetContentRequest
  | GetContentResponse
  | ContentChangeEvent
  | ApplyChangesRequest
  | ApplyDoneEvent
  | BridgeReadyEvent

// ─── Chrome Runtime Messages ──────────────────────────────────────────────────

export type RuntimeMessage =
  | { type: 'BRIDGE_INJECT_REQUEST' }
  | { type: 'ANALYZE_REQUEST'; payload: { blocks: LaTeXBlock[]; jd: JobContext } }
  | { type: 'ANALYZE_STREAM_CHUNK'; payload: { chunk: string } }
  | { type: 'ANALYZE_COMPLETE'; payload: { changes: ProposedChange[] } }
  | { type: 'ANALYZE_ERROR'; payload: { error: string } }
  | { type: 'SAVE_JD'; payload: JobContext }
  | { type: 'GET_JD' }
  | { type: 'GET_JD_RESPONSE'; payload: JobContext | null }
  | { type: 'GET_SETTINGS' }
  | { type: 'GET_SETTINGS_RESPONSE'; payload: AppSettings }
  | { type: 'SAVE_SETTINGS'; payload: Partial<AppSettings> }
