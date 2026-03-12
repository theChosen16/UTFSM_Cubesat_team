import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Shield, 
  Users, 
  Search,
  MoreHorizontal,
  Crown,
  Settings,
  Cpu,
  Globe,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { User as UserType, ROLE_LABELS, UserRole, TeamType, TEAM_LABELS, hasRole, hasAnyRole } from '@/types'
import { logger } from '@/lib/logger'
import { extractNameFromEmail } from '@/lib/utils'

const TEAM_CONFIG: { key: TeamType | 'none'; label: string; icon: typeof Users; color: string; bgColor: string; borderColor: string }[] = [
  { key: 'tecnico', label: 'Equipo Técnico', icon: Cpu, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30' },
  { key: 'manager', label: 'Manager', icon: Users, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/30' },
  { key: 'relaciones_publicas', label: 'Relaciones Públicas', icon: Globe, color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
  { key: 'none', label: 'Sin equipo asignado', icon: User, color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' },
]

export default function Members() {
  const { user, getAllUsers, updateUserRole, updateUserTeams } = useAuth()
  const [members, setMembers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const loadMembers = useCallback(async () => {
    try {
      const users = await getAllUsers()
      setMembers(users)
    } catch (error) {
      logger.error('Error loading members', { error: error instanceof Error ? error : undefined })
    } finally {
      setLoading(false)
    }
  }, [getAllUsers])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const handleRoleChange = async (userId: string, newRole: UserRole | undefined) => {
    if (!hasRole(user, 'maestro')) {
      logger.warn('Non-maestro user attempted to assign role', { userId })
      return
    }
    try {
      await updateUserRole(userId, newRole)
      await loadMembers()
    } catch (error) {
      logger.error('Error updating role', { error: error instanceof Error ? error : undefined, userId })
    }
  }

  const handleTeamToggle = async (userId: string, team: TeamType, currentTeams: TeamType[]) => {
    let newTeams: TeamType[]
    if (currentTeams.includes(team)) {
      newTeams = currentTeams.filter(t => t !== team)
    } else {
      if (currentTeams.length >= 2) {
        logger.warn('Max 2 teams allowed', { userId })
        return
      }
      newTeams = [...currentTeams, team]
    }
    try {
      await updateUserTeams(userId, newTeams)
      await loadMembers()
    } catch (error) {
      logger.error('Error updating teams', { error: error instanceof Error ? error : undefined, userId, newTeams })
    }
  }

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'maestro': return Crown
      case 'admin': return Settings
    }
  }

      const filteredMembers = members.filter(member =>
    (member.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.apellido || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getMemberDisplayName = (member: UserType) => {
    if (member.nombre) return `${member.nombre} ${member.apellido || ''}`.trim()
    const extracted = extractNameFromEmail(member.email)
    return extracted && extracted !== '?' ? extracted : 'Miembro'
  }

  const getMemberInitials = (member: UserType) => {
    if (member.nombre) {
      const first = member.nombre.trim().charAt(0).toUpperCase() || '?'
      const last = (member.apellido || '').trim().charAt(0).toUpperCase()
      return last ? `${first}${last}` : first
    }
    const extracted = extractNameFromEmail(member.email)
    return (extracted && extracted !== '?') ? extracted.charAt(0).toUpperCase() : 'M'
  }

  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set())

  const toggleTeam = (teamKey: string) => {
    setCollapsedTeams(prev => {
      const next = new Set(prev)
      if (next.has(teamKey)) next.delete(teamKey)
      else next.add(teamKey)
      return next
    })
  }

  const groupedMembers = TEAM_CONFIG.reduce<Record<string, UserType[]>>((acc, team) => {
    acc[team.key] = filteredMembers.filter(m =>
      team.key === 'none' ? (!m.equipos || m.equipos.length === 0) : m.equipos?.includes(team.key as TeamType)
    )
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Miembros del Equipo</h1>
          <p className="text-muted-foreground mt-1">
            Directorio de miembros y sus funciones en el equipo
          </p>
        </div>
        {hasAnyRole(user, 'maestro', 'admin') && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-orange-400" />
            <span>Gestión de roles habilitada</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar miembros..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-space-700 border border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Members grouped by team */}
      {TEAM_CONFIG.map((team) => {
        const teamMembers = groupedMembers[team.key]
        if (teamMembers.length === 0) return null

        const TeamIcon = team.icon
        const isCollapsed = collapsedTeams.has(team.key)

        return (
          <div key={team.key} className="space-y-4">
            {/* Team section header */}
            <button
              onClick={() => toggleTeam(team.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${team.bgColor} border ${team.borderColor} hover:brightness-110 transition-all`}
            >
              <div className={`p-2 rounded-lg ${team.bgColor}`}>
                <TeamIcon className={`w-5 h-5 ${team.color}`} />
              </div>
              <h2 className="text-lg font-semibold text-white flex-1 text-left truncate">{team.label}</h2>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {teamMembers.length} {teamMembers.length === 1 ? 'miembro' : 'miembros'}
              </Badge>
              {isCollapsed
                ? <ChevronRight className="w-5 h-5 text-muted-foreground" />
                : <ChevronDown className="w-5 h-5 text-muted-foreground" />
              }
            </button>

            {/* Team member cards */}
            {!isCollapsed && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teamMembers.map((member) => {
                  const isCurrentUser = user?.id === member.id
                  const isMaster = hasRole(user, 'maestro')

                  return (
                    <Card key={member.id} className="bg-space-700/50 border-space-600">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            {member.photoURL ? (
                              <img 
                                src={member.photoURL} 
                                alt={`${member.nombre} ${member.apellido}`}
                                className="w-12 h-12 rounded-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }}
                              />
                            ) : null}
                              <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center ${member.photoURL ? 'hidden' : ''}`}>
                                <span className="text-white font-bold text-lg">
                                  {getMemberInitials(member)}
                                </span>
                              </div>
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-base text-white truncate">
                                {getMemberDisplayName(member)}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-cyan-400">(Tú)</span>
                                )}
                              </CardTitle>
                              <CardDescription className="text-sm truncate">{member.email}</CardDescription>
                            </div>
                          </div>
                          {isMaster && !isCurrentUser && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Show role badge */}
                        {member.rol && (() => {
                          const RoleIcon = getRoleIcon(member.rol)
                          const colorMap = { maestro: 'orange', admin: 'red' } as const
                          const bgMap = { maestro: 'bg-orange-500/20', admin: 'bg-red-500/20' }
                          const textMap = { maestro: 'text-orange-400', admin: 'text-red-400' }
                          return (
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${bgMap[member.rol]}`}>
                                <RoleIcon className={`w-4 h-4 ${textMap[member.rol]}`} />
                              </div>
                              <div className="flex-1">
                                <Badge variant={colorMap[member.rol]}>
                                  {ROLE_LABELS[member.rol]}
                                </Badge>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Role Assignment (Maestro only — single select) */}
                        {isMaster && !isCurrentUser && (
                          <div className="pt-3 border-t border-space-600">
                            <label className="text-xs text-muted-foreground mb-2 block">Asignar rol:</label>
                            <select
                              value={member.rol || ''}
                              onChange={(e) => {
                                const val = e.target.value as UserRole | ''
                                handleRoleChange(member.id, val ? val as UserRole : undefined)
                              }}
                              title="Cambiar rol del miembro"
                              className="w-full px-3 py-2 rounded-lg bg-space-600 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                            >
                              <option value="">Sin rol</option>
                              {(['admin', 'maestro'] as UserRole[]).map(role => (
                                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Team Assignment (Maestro or Admin — checkboxes, max 2) */}
                        {(isMaster || hasRole(user, 'admin')) && !isCurrentUser && (
                          <div className="pt-3 border-t border-space-600">
                            <label className="text-xs text-muted-foreground mb-2 block">Asignar equipos (máx. 2):</label>
                            <div className="space-y-2">
                              {(['tecnico', 'manager', 'relaciones_publicas'] as TeamType[]).map(team => {
                                const checked = member.equipos?.includes(team) ?? false
                                const disabled = !checked && (member.equipos?.length ?? 0) >= 2
                                return (
                                  <label key={team} className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-space-600 border border-space-500 text-sm cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-cyan-500'}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={() => handleTeamToggle(member.id, team, member.equipos || [])}
                                      className="accent-cyan-500"
                                      title={`Asignar equipo ${TEAM_LABELS[team]}`}
                                    />
                                    <span className="text-white">{TEAM_LABELS[team]}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No se encontraron miembros</p>
        </div>
      )}
    </div>
  )
}
