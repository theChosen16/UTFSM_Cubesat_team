import { describe, it, expect } from 'vitest'
import {
  TEAM_LABELS,
  TEAM_COLORS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  sanitizeUserRole,
  sanitizeUserRoles,
  hasRole,
  hasAnyRole,
  sanitizeTeamType,
  sanitizeGenero
} from '@/types'
import type { TeamType, UserRole } from '@/types'

describe('Types', () => {
  describe('Team constants', () => {
    it('defines all team labels', () => {
      const teams: TeamType[] = ['tecnico', 'manager', 'relaciones_publicas']
      teams.forEach(team => {
        expect(TEAM_LABELS[team]).toBeDefined()
        expect(typeof TEAM_LABELS[team]).toBe('string')
        expect(TEAM_LABELS[team].length).toBeGreaterThan(0)
      })
    })

    it('defines all team colors', () => {
      const teams: TeamType[] = ['tecnico', 'manager', 'relaciones_publicas']
      teams.forEach(team => {
        expect(TEAM_COLORS[team]).toBeDefined()
        expect(TEAM_COLORS[team]).toMatch(/^bg-/)
      })
    })

    it('has matching keys between TEAM_LABELS and TEAM_COLORS', () => {
      expect(Object.keys(TEAM_LABELS).sort()).toEqual(Object.keys(TEAM_COLORS).sort())
    })
  })

  describe('Role constants', () => {
    it('defines all role labels', () => {
      const roles: UserRole[] = ['maestro', 'admin']
      roles.forEach(role => {
        expect(ROLE_LABELS[role]).toBeDefined()
        expect(typeof ROLE_LABELS[role]).toBe('string')
      })
    })

    it('defines all role descriptions', () => {
      const roles: UserRole[] = ['maestro', 'admin']
      roles.forEach(role => {
        expect(ROLE_DESCRIPTIONS[role]).toBeDefined()
        expect(ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(10)
      })
    })

    it('sanitizes unknown roles with safe fallback', () => {
      expect(sanitizeUserRole('maestro')).toBe('maestro')
      expect(sanitizeUserRole('admin')).toBe('admin')
      expect(sanitizeUserRole('invalid-role')).toBeUndefined()
      expect(sanitizeUserRole(undefined)).toBeUndefined()
      expect(sanitizeUserRole(null)).toBeUndefined()
      expect(sanitizeUserRole(123)).toBeUndefined()
      expect(sanitizeUserRole({ rol: 'admin' })).toBeUndefined()
      expect(sanitizeUserRole(['maestro'])).toBeUndefined()
    })
  })

  describe('Input sanitizers', () => {
    it('returns undefined for unknown team type', () => {
      expect(sanitizeTeamType('tecnico')).toBe('tecnico')
      expect(sanitizeTeamType('estructura')).toBeUndefined()
      expect(sanitizeTeamType(null)).toBeUndefined()
      expect(sanitizeTeamType(undefined)).toBeUndefined()
      expect(sanitizeTeamType(10)).toBeUndefined()
      expect(sanitizeTeamType({ equipo: 'tecnico' })).toBeUndefined()
    })

    it('returns undefined for unknown genero', () => {
      expect(sanitizeGenero('masculino')).toBe('masculino')
      expect(sanitizeGenero('prefiero_no_decir')).toBeUndefined()
    })
  })

  describe('sanitizeUserRoles', () => {
    it('returns empty array for undefined/null input', () => {
      expect(sanitizeUserRoles(undefined)).toEqual([])
      expect(sanitizeUserRoles(null)).toEqual([])
    })

    it('sanitizes a valid roles array', () => {
      expect(sanitizeUserRoles(['maestro'])).toEqual(['maestro'])
      expect(sanitizeUserRoles(['admin', 'maestro'])).toEqual(['admin', 'maestro'])
    })

    it('filters out invalid roles from array', () => {
      expect(sanitizeUserRoles(['maestro', 'invalid'])).toEqual(['maestro'])
      expect(sanitizeUserRoles(['invalid'])).toEqual([])
    })

    it('limits to max 2 roles', () => {
      expect(sanitizeUserRoles(['maestro', 'admin', 'maestro'])).toEqual(['maestro', 'admin'])
    })

    it('deduplicates roles', () => {
      expect(sanitizeUserRoles(['maestro', 'maestro'])).toEqual(['maestro'])
    })

    it('falls back to legacy rol when roles is not an array', () => {
      expect(sanitizeUserRoles(undefined, 'maestro')).toEqual(['maestro'])
      expect(sanitizeUserRoles(null, 'admin')).toEqual(['admin'])
    })

    it('ignores invalid legacy rol', () => {
      expect(sanitizeUserRoles(undefined, 'invalid')).toEqual([])
      expect(sanitizeUserRoles(undefined, undefined)).toEqual([])
    })
  })

  describe('hasRole', () => {
    it('returns true when user has the role', () => {
      expect(hasRole({ roles: ['maestro'] }, 'maestro')).toBe(true)
      expect(hasRole({ roles: ['admin', 'maestro'] }, 'admin')).toBe(true)
    })

    it('returns false when user does not have the role', () => {
      expect(hasRole({ roles: ['admin'] }, 'maestro')).toBe(false)
      expect(hasRole({ roles: [] }, 'maestro')).toBe(false)
    })

    it('returns false for null/undefined user', () => {
      expect(hasRole(null, 'maestro')).toBe(false)
      expect(hasRole(undefined, 'maestro')).toBe(false)
    })

    it('returns false when roles is undefined', () => {
      expect(hasRole({ roles: undefined }, 'maestro')).toBe(false)
    })
  })

  describe('hasAnyRole', () => {
    it('returns true when user has any of the specified roles', () => {
      expect(hasAnyRole({ roles: ['admin'] }, 'maestro', 'admin')).toBe(true)
    })

    it('returns false when user has none of the specified roles', () => {
      expect(hasAnyRole({ roles: [] }, 'maestro', 'admin')).toBe(false)
    })

    it('returns false for null/undefined user', () => {
      expect(hasAnyRole(null, 'maestro', 'admin')).toBe(false)
    })
  })
})
