export type LaTeXBlockType =
  | 'section'
  | 'subsection'
  | 'resumeItem'
  | 'resumeSubheading'
  | 'resumeProjectHeading'
  | 'environment'
  | 'preamble'
  | 'unknown'

export interface TextRange {
  start: number
  end: number
  startLine: number
  endLine: number
}

export interface LaTeXBlock {
  id: string
  type: LaTeXBlockType
  label: string
  content: string
  range: TextRange
  metadata?: {
    envName?: string
    args?: string[]
  }
}

export interface ParsedDocument {
  blocks: LaTeXBlock[]
  fullContent: string
  parseTimestamp: number
}
