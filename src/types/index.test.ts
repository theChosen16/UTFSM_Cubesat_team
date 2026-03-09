import { describe, it, expect } from 'vitest'
import { TEAM_LABELS, TEAM_COLORS, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/types'
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
      const roles: UserRole[] = ['maestro', 'admin', 'manager', 'tecnico', 'relaciones_publicas']
      roles.forEach(role => {
        expect(ROLE_LABELS[role]).toBeDefined()
        expect(typeof ROLE_LABELS[role]).toBe('string')
      })
    })

    it('defines all role descriptions', () => {
      const roles: UserRole[] = ['maestro', 'admin', 'manager', 'tecnico', 'relaciones_publicas']
      roles.forEach(role => {
        expect(ROLE_DESCRIPTIONS[role]).toBeDefined()
        expect(ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(10)
      })
    })
  })
})
