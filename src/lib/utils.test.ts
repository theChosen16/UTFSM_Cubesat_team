import { describe, it, expect } from 'vitest'
import { extractNameFromEmail, extractFullNameFromEmail } from '@/lib/utils'

describe('extractNameFromEmail', () => {
  it('extracts first name from standard email', () => {
    expect(extractNameFromEmail('alejandro.hernandeza@sansano.usm.cl')).toBe('Alejandro')
  })

  it('returns ? for null/undefined', () => {
    expect(extractNameFromEmail(null)).toBe('?')
    expect(extractNameFromEmail(undefined)).toBe('?')
  })
})

describe('extractFullNameFromEmail', () => {
  it('extracts nombre and apellido from dotted email', () => {
    const result = extractFullNameFromEmail('alejandro.hernandeza@sansano.usm.cl')
    expect(result).toEqual({ nombre: 'Alejandro', apellido: 'Hernandeza' })
  })

  it('returns only nombre when no dot in local part', () => {
    const result = extractFullNameFromEmail('juan@usm.cl')
    expect(result).toEqual({ nombre: 'Juan', apellido: '' })
  })

  it('capitalizes names correctly', () => {
    const result = extractFullNameFromEmail('MARIA.gonzalez@sansano.usm.cl')
    expect(result).toEqual({ nombre: 'Maria', apellido: 'Gonzalez' })
  })

  it('handles empty string', () => {
    const result = extractFullNameFromEmail('')
    expect(result).toEqual({ nombre: '', apellido: '' })
  })
})
