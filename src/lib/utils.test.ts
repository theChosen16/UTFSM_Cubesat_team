import { describe, it, expect } from 'vitest'
import { extractNameFromEmail, extractFullNameFromEmail } from '@/lib/utils'

describe('extractNameFromEmail', () => {
  it('extracts first name from standard email', () => {
    expect(extractNameFromEmail('test.usuario@sansano.usm.cl')).toBe('Test')
  })

  it('returns ? for null/undefined', () => {
    expect(extractNameFromEmail(null)).toBe('?')
    expect(extractNameFromEmail(undefined)).toBe('?')
  })
})

describe('extractFullNameFromEmail', () => {
  it('extracts nombre and apellido from dotted email', () => {
    const result = extractFullNameFromEmail('test.usuario@sansano.usm.cl')
    expect(result).toEqual({ nombre: 'Test', apellido: 'Usuario' })
  })

  it('returns only nombre when no dot in local part', () => {
    const result = extractFullNameFromEmail('juan@usm.cl')
    expect(result).toEqual({ nombre: 'Juan', apellido: '' })
  })

  it('capitalizes names correctly', () => {
    const result = extractFullNameFromEmail('MOCK.estudiante@sansano.usm.cl')
    expect(result).toEqual({ nombre: 'Mock', apellido: 'Estudiante' })
  })

  it('handles empty string', () => {
    const result = extractFullNameFromEmail('')
    expect(result).toEqual({ nombre: '', apellido: '' })
  })
})
