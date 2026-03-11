import { describe, it, expect } from 'vitest'
import {
  TEAM_LABELS,
  TEAM_COLORS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  sanitizeUserRole,
  sanitizeUserTeams,
  hasRole,
  hasAnyRole,
  hasTeam,
  hasAnyTeam,
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

  describe('sanitizeUserTeams', () => {
    it('returns empty array for undefined/null input', () => {
      expect(sanitizeUserTeams(undefined)).toEqual([])
      expect(sanitizeUserTeams(null)).toEqual([])
    })

    it('sanitizes a valid teams array', () => {
      expect(sanitizeUserTeams(['tecnico'])).toEqual(['tecnico'])
      expect(sanitizeUserTeams(['manager', 'tecnico'])).toEqual(['manager', 'tecnico'])
    })

    it('filters out invalid teams from array', () => {
      expect(sanitizeUserTeams(['tecnico', 'invalid'])).toEqual(['tecnico'])
      expect(sanitizeUserTeams(['invalid'])).toEqual([])
    })

    it('limits to max 2 teams', () => {
      expect(sanitizeUserTeams(['tecnico', 'manager', 'relaciones_publicas'])).toEqual(['tecnico', 'manager'])
    })

    it('deduplicates teams', () => {
      expect(sanitizeUserTeams(['tecnico', 'tecnico'])).toEqual(['tecnico'])
    })

    it('falls back to legacy equipo when teams is not an array', () => {
      expect(sanitizeUserTeams(undefined, 'tecnico')).toEqual(['tecnico'])
      expect(sanitizeUserTeams(null, 'manager')).toEqual(['manager'])
    })

    it('ignores invalid legacy equipo', () => {
      expect(sanitizeUserTeams(undefined, 'invalid')).toEqual([])
      expect(sanitizeUserTeams(undefined, undefined)).toEqual([])
    })
  })

  describe('hasRole', () => {
    it('returns true when user has the role', () => {
      expect(hasRole({ rol: 'maestro' }, 'maestro')).toBe(true)
      expect(hasRole({ rol: 'admin' }, 'admin')).toBe(true)
    })

    it('returns false when user does not have the role', () => {
      expect(hasRole({ rol: 'admin' }, 'maestro')).toBe(false)
      expect(hasRole({ rol: undefined }, 'maestro')).toBe(false)
    })

    it('returns false for null/undefined user', () => {
      expect(hasRole(null, 'maestro')).toBe(false)
      expect(hasRole(undefined, 'maestro')).toBe(false)
    })

    it('returns false when rol is undefined', () => {
      expect(hasRole({ rol: undefined }, 'maestro')).toBe(false)
    })
  })

  describe('hasAnyRole', () => {
    it('returns true when user has any of the specified roles', () => {
      expect(hasAnyRole({ rol: 'admin' }, 'maestro', 'admin')).toBe(true)
    })

    it('returns false when user has none of the specified roles', () => {
      expect(hasAnyRole({ rol: undefined }, 'maestro', 'admin')).toBe(false)
    })

    it('returns false for null/undefined user', () => {
      expect(hasAnyRole(null, 'maestro', 'admin')).toBe(false)
    })
  })

  describe('hasTeam', () => {
    it('returns true when user belongs to the team', () => {
      expect(hasTeam({ equipos: ['tecnico'] }, 'tecnico')).toBe(true)
      expect(hasTeam({ equipos: ['tecnico', 'manager'] }, 'manager')).toBe(true)
    })

    it('returns false when user does not belong to the team', () => {
      expect(hasTeam({ equipos: ['tecnico'] }, 'manager')).toBe(false)
      expect(hasTeam({ equipos: [] }, 'tecnico')).toBe(false)
    })

    it('returns false for null/undefined user', () => {
      expect(hasTeam(null, 'tecnico')).toBe(false)
      expect(hasTeam(undefined, 'tecnico')).toBe(false)
    })
  })

  describe('hasAnyTeam', () => {
    it('returns true when user belongs to any of the specified teams', () => {
      expect(hasAnyTeam({ equipos: ['tecnico'] }, 'tecnico', 'manager')).toBe(true)
    })

    it('returns false when user belongs to none of the specified teams', () => {
      expect(hasAnyTeam({ equipos: ['relaciones_publicas'] }, 'tecnico', 'manager')).toBe(false)
    })

    it('returns false for null/undefined user', () => {
      expect(hasAnyTeam(null, 'tecnico', 'manager')).toBe(false)
    })
  })
})
