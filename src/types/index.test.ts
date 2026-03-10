import { describe, it, expect } from 'vitest'
import {
  TEAM_LABELS,
  TEAM_COLORS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  sanitizeUserRole,
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
})
