import { describe, it, expect } from 'vitest'
import { extractKeywords } from '../keywords'

describe('extractKeywords', () => {
  it('returns empty array for empty string', () => {
    expect(extractKeywords('')).toEqual([])
  })

  it('extracts tech stack keywords', () => {
    const keywords = extractKeywords(
      'We use React, TypeScript, and Python for our stack.',
    )
    expect(keywords).toContain('React')
    expect(keywords).toContain('TypeScript')
    expect(keywords).toContain('Python')
  })

  it('extracts cloud/infra keywords', () => {
    const keywords = extractKeywords(
      'Deploy services on AWS using Docker and Kubernetes.',
    )
    expect(keywords).toContain('AWS')
    expect(keywords).toContain('Docker')
    expect(keywords).toContain('Kubernetes')
  })

  it('extracts soft skill keywords', () => {
    const text = 'We value cross-functional collaboration and strong leadership skills.'
    const keywords = extractKeywords(text)
    const lower = keywords.map((k) => k.toLowerCase())
    expect(lower.some((k) => k.includes('cross'))).toBe(true)
    expect(lower.some((k) => k.includes('leadership'))).toBe(true)
  })

  it('deduplicates the same keyword appearing multiple times', () => {
    const keywords = extractKeywords('React and React and REACT developers needed')
    const reactCount = keywords.filter((k) => k.toLowerCase() === 'react').length
    expect(reactCount).toBe(1)
  })

  it('extracts years of experience', () => {
    const keywords = extractKeywords(
      'Requires 5+ years of experience in backend development',
    )
    const exp = keywords.find((k) => k.includes('years'))
    expect(exp).toBeDefined()
    expect(exp).toContain('5+')
  })

  it('extracts certification keywords', () => {
    const keywords = extractKeywords(
      'AWS Certified Solutions Architect preferred.',
    )
    expect(keywords.some((k) => k.includes('AWS Certified'))).toBe(true)
  })

  it('extracts domain keywords', () => {
    const keywords = extractKeywords(
      'B2B SaaS platform focused on fintech and compliance.',
    )
    const lower = keywords.map((k) => k.toLowerCase())
    expect(lower.some((k) => k.includes('saas'))).toBe(true)
    expect(lower.some((k) => k.includes('b2b'))).toBe(true)
  })

  it('caps results at 50 keywords', () => {
    const techTerms =
      'Python JavaScript TypeScript React Angular Vue Node.js Express Django Flask FastAPI Spring Java C++ Golang Rust Ruby Rails PHP Swift Kotlin Scala SQL PostgreSQL MySQL MongoDB Redis DynamoDB Docker Kubernetes Terraform Jenkins Datadog Prometheus Kafka RabbitMQ AWS GCP Azure S3 EC2 Lambda Machine Learning NLP TensorFlow PyTorch scikit-learn Git REST GraphQL Agile Scrum'
    const keywords = extractKeywords(techTerms)
    expect(keywords.length).toBeLessThanOrEqual(50)
  })
})
