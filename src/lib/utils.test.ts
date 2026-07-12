import { describe, it, expect } from 'vitest'
import { extractNameFromEmail, extractFullNameFromEmail, sanitizeUrl } from '@/lib/utils'

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

describe('sanitizeUrl', () => {
  it('allows http and https URLs', () => {
    expect(sanitizeUrl('https://linkedin.com/in/foo')).toBe('https://linkedin.com/in/foo')
    expect(sanitizeUrl('http://example.com/path?a=1')).toBe('http://example.com/path?a=1')
  })

  it('allows mailto URLs', () => {
    expect(sanitizeUrl('mailto:team@usm.cl')).toBe('mailto:team@usm.cl')
  })

  it('prepends https:// to scheme-less values', () => {
    expect(sanitizeUrl('github.com/theChosen16')).toBe('https://github.com/theChosen16')
    expect(sanitizeUrl('drive.google.com/file/d/abc/view')).toBe('https://drive.google.com/file/d/abc/view')
  })

  it('rejects javascript: URIs (stored XSS vector)', () => {
    expect(sanitizeUrl('javascript:alert(document.cookie)')).toBeUndefined()
    expect(sanitizeUrl('JavaScript:alert(1)')).toBeUndefined()
    // Esquema con espacios/tabs/saltos de línea de contrabando
    expect(sanitizeUrl('java\tscript:alert(1)')).toBeUndefined()
    expect(sanitizeUrl('  javascript:alert(1)  ')).toBeUndefined()
    expect(sanitizeUrl('java\nscript:alert(1)')).toBeUndefined()
  })

  it('rejects data:, vbscript: and file: URIs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeUndefined()
    expect(sanitizeUrl('file:///etc/passwd')).toBeUndefined()
  })

  it('rejects empty, whitespace-only and non-string values', () => {
    expect(sanitizeUrl('')).toBeUndefined()
    expect(sanitizeUrl('   ')).toBeUndefined()
    expect(sanitizeUrl(undefined)).toBeUndefined()
    expect(sanitizeUrl(null)).toBeUndefined()
    expect(sanitizeUrl(123)).toBeUndefined()
  })
})
