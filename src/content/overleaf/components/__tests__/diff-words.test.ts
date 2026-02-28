import { describe, it, expect } from 'vitest'
import { diffWords } from '../ChangePreview'

describe('diffWords', () => {
  it('identical strings produce only equal tokens', () => {
    const { before, after } = diffWords('hello world', 'hello world')
    expect(before.every((t) => t.type === 'equal')).toBe(true)
    expect(after.every((t) => t.type === 'equal')).toBe(true)
  })

  it('reconstructs the original string from before tokens', () => {
    const original = 'Worked on backend services for enterprise clients'
    const modified = 'Engineered RESTful API services serving 50k+ enterprise clients'
    const { before } = diffWords(original, modified)
    expect(before.map((t) => t.text).join('')).toBe(original)
  })

  it('reconstructs the modified string from after tokens', () => {
    const original = 'Worked on backend services'
    const modified = 'Engineered scalable backend microservices serving 100k users'
    const { after } = diffWords(original, modified)
    expect(after.map((t) => t.text).join('')).toBe(modified)
  })

  it('marks changed word as delete in before and insert in after', () => {
    const { before, after } = diffWords('hello world', 'hello earth')
    expect(before.some((t) => t.type === 'delete' && t.text === 'world')).toBe(true)
    expect(after.some((t) => t.type === 'insert' && t.text === 'earth')).toBe(true)
  })

  it('before tokens never contain insert tokens', () => {
    const { before } = diffWords('the quick brown fox', 'the quick red fox')
    expect(before.some((t) => t.type === 'insert')).toBe(false)
  })

  it('after tokens never contain delete tokens', () => {
    const { after } = diffWords('the quick brown fox', 'the quick red fox')
    expect(after.some((t) => t.type === 'delete')).toBe(false)
  })

  it('handles empty strings', () => {
    const { before, after } = diffWords('', '')
    expect(before).toHaveLength(0)
    expect(after).toHaveLength(0)
  })

  it('handles insertion of new word (before shorter than after)', () => {
    const { after } = diffWords('hello world', 'hello beautiful world')
    expect(after.some((t) => t.type === 'insert' && t.text === 'beautiful')).toBe(true)
  })

  it('handles deletion of a word (after shorter than before)', () => {
    const { before } = diffWords('hello beautiful world', 'hello world')
    expect(before.some((t) => t.type === 'delete' && t.text === 'beautiful')).toBe(true)
  })

  it('equal tokens in before and after have matching text', () => {
    const { before, after } = diffWords('a b c d', 'a x c d')
    const beforeEqual = before.filter((t) => t.type === 'equal').map((t) => t.text)
    const afterEqual = after.filter((t) => t.type === 'equal').map((t) => t.text)
    expect(beforeEqual).toEqual(afterEqual)
  })
})
