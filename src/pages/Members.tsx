import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  User,
  Shield,
  Users,
  Search,
  MoreHorizontal,
  Cpu,
  Globe,
  ChevronDown,
  ChevronRight,
  Info,
  Trophy,
  History,
} from 'lucide-react'
import { ActivityLogEntry, Task, User as UserType, UserRole, TeamType, hasRole, hasAnyRole } from '@/types'
import { ROLE_LABELS, TEAM_LABELS } from '@/lib/ui-constants'
import { logger } from '@/lib/logger'
import { extractNameFromEmail, getRoleIcon } from '@/lib/utils'
import { TaskService } from '@/sdk/TaskService'
import { ActivityLogService } from '@/sdk/ActivityLogService'
import { buildMemberPerformance, getMemberRankInfo } from '@/lib/memberMetrics'

const TEAM_CONFIG: { key: TeamType | 'none'; label: string; icon: typeof Users; color: string; bgColor: string; borderColor: string }[] = [
  { key: 'tecnico', label: 'Equipo Técnico', icon: Cpu, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30' },
  { key: 'manager', label: 'Manager', icon: Users, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/30' },
  { key: 'relaciones_publicas', label: 'Relaciones Públicas', icon: Globe, color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
  { key: 'none', label: 'Sin equipo asignado', icon: User, color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' },
]

const getActivitySummary = (activity?: ActivityLogEntry) => {
  if (!activity) return 'Sin actividad registrada aún.'
  return `${activity.description} · ${activity.createdAt.toLocaleDateString('es-CL')}`
}

export default function Members() {
  const { user, getAllUsers, updateUserRole, updateUserTeams } = useAuth()
  const [members, setMembers] = useState<UserType[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [allActivity, setAllActivity] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set())

  const loadMembers = useCallback(async () => {
    try {
      const [usersResult, tasksResult, activityResult] = await Promise.allSettled([
        getAllUsers(),
        TaskService.getAll(),
        ActivityLogService.getAll(),
      ])

      if (usersResult.status === 'fulfilled') setMembers(usersResult.value)
      else logger.error('Error loading members', { error: usersResult.reason instanceof Error ? usersResult.reason : undefined })

      if (tasksResult.status === 'fulfilled') setAllTasks(tasksResult.value)
      else logger.error('Error loading tasks', { error: tasksResult.reason instanceof Error ? tasksResult.reason : undefined })

      if (activityResult.status === 'fulfilled') setAllActivity(activityResult.value)
      // activity log is optional — silent fail is acceptable
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
    if (!hasRole(user, 'maestro') && !hasRole(user, 'admin')) {
      logger.warn('Unauthorized team update attempt', { userId })
      return
    }
    let newTeams: TeamType[]
    if (currentTeams.includes(team)) {
      newTeams = currentTeams.filter(currentTeam => currentTeam !== team)
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

  const filteredMembers = members.filter(member =>
    (member.nombre || '').toLowerCase().includes(searchQuery.toLowerCase())
    || (member.apellido || '').toLowerCase().includes(searchQuery.toLowerCase())
    || (member.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const performanceByMember = useMemo(() => {
    return new Map(members.map(member => [member.id, buildMemberPerformance(member.id, allTasks, allActivity)]))
  }, [members, allTasks, allActivity])

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

  const toggleTeam = (teamKey: string) => {
    setCollapsedTeams(prev => {
      const next = new Set(prev)
      if (next.has(teamKey)) next.delete(teamKey)
      else next.add(teamKey)
      return next
    })
  }

  const groupedMembers = TEAM_CONFIG.reduce<Record<string, UserType[]>>((acc, team) => {
    acc[team.key] = filteredMembers
      .filter(member => team.key === 'none'
        ? (!member.equipos || member.equipos.length === 0)
        : member.equipos?.includes(team.key as TeamType))
      .sort((left, right) => {
        const leftPerformance = performanceByMember.get(left.id)
        const rightPerformance = performanceByMember.get(right.id)
        const leftScore = leftPerformance?.totalScore ?? 0
        const rightScore = rightPerformance?.totalScore ?? 0
        if (rightScore !== leftScore) return rightScore - leftScore
        return (rightPerformance?.activityCount ?? 0) - (leftPerformance?.activityCount ?? 0)
      })
    return acc
  }, {})

  if (loading) {
    return <Spinner />
  }

  return (
    <div className="page-shell">
      <div className="page-header animate-fade-in-up">
        <div>
          <h1 className="page-title">Miembros del Equipo</h1>
          <p className="page-copy">
            Directorio de miembros, ranking de aportes y actividad reciente.
          </p>
        </div>
        {hasAnyRole(user, 'maestro', 'admin') && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-orange-400" />
            <span>Gestión de roles habilitada</span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-space-600/50 bg-space-800/80 p-4 animate-fade-in-up sm:p-5">
        <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-300">
          <strong className="text-white">Nota Histórica:</strong> El ranking ahora considera puntaje acumulado, tareas completadas y actividad registrada para que el seguimiento del proyecto deje evidencia clara de quién hizo qué.
        </p>
      </div>

      <div className="relative w-full max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Buscar miembros..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Buscar miembros por nombre o correo"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-space-700 border border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500 focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-cyan-500/20"
        />
      </div>

      {TEAM_CONFIG.map((team) => {
        const teamMembers = groupedMembers[team.key]
        if (teamMembers.length === 0) return null

        const TeamIcon = team.icon
        const isCollapsed = collapsedTeams.has(team.key)

        return (
          <div key={team.key} className="space-y-4">
            <button
              onClick={() => toggleTeam(team.key)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3.5 transition-all duration-200 hover:brightness-110 sm:px-4 ${team.bgColor} ${team.borderColor}`}
            >
              <div className={`p-2 rounded-lg ${team.bgColor}`}>
                <TeamIcon className={`w-5 h-5 ${team.color}`} />
              </div>
              <h2 className="flex-1 truncate text-left text-base font-semibold text-white sm:text-lg">{team.label}</h2>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {teamMembers.length} {teamMembers.length === 1 ? 'miembro' : 'miembros'}
              </Badge>
              {isCollapsed
                ? <ChevronRight className="w-5 h-5 text-muted-foreground" />
                : <ChevronDown className="w-5 h-5 text-muted-foreground" />
              }
            </button>

            {!isCollapsed && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 xl:gap-6" aria-label={`Miembros de ${team.label}`}>
                {teamMembers.map((member) => {
                  const isCurrentUser = user?.id === member.id
                  const isMaster = hasRole(user, 'maestro')
                  const performance = performanceByMember.get(member.id) || buildMemberPerformance(member.id, allTasks, allActivity)
                  const rank = getMemberRankInfo(performance.totalScore)

                  return (
                    <Card key={member.id} className="bg-space-700/50 border-space-600 hover:border-cyan-500/30 transition-all duration-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            {member.photoURL ? (
                              <img
                                src={member.photoURL}
                                alt={`${member.nombre} ${member.apellido}`}
                                loading="lazy"
                                className="w-12 h-12 rounded-full object-cover"
                                onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.nextElementSibling?.classList.remove('hidden') }}
                              />
                            ) : null}
                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center ${member.photoURL ? 'hidden' : ''}`}>
                              <span className="text-white font-bold text-lg">
                                {getMemberInitials(member)}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-base text-white truncate">
                                <Link to={`/profile/${member.id}`} className="hover:text-cyan-400 transition-colors">
                                  {getMemberDisplayName(member)}
                                </Link>
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-cyan-400">(Tú)</span>
                                )}
                              </CardTitle>
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
                        <div className="flex flex-col gap-2">
                          <div className={`w-fit px-3 py-1 rounded-full border flex items-center gap-2 text-xs font-semibold ${rank.color}`}>
                            <Trophy className="w-3.5 h-3.5" />
                            <span>Rango: {rank.label}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                            <div className="rounded-lg bg-space-800/60 px-3 py-2 text-center">
                              <p className="text-white font-semibold">{performance.totalScore}</p>
                              <p className="text-muted-foreground">Puntos</p>
                            </div>
                            <div className="rounded-lg bg-space-800/60 px-3 py-2 text-center">
                              <p className="text-white font-semibold">{performance.completedCount}</p>
                              <p className="text-muted-foreground">Terminadas</p>
                            </div>
                            <div className="rounded-lg bg-space-800/60 px-3 py-2 text-center">
                              <p className="text-white font-semibold">{performance.pendingCount}</p>
                              <p className="text-muted-foreground">Pendientes</p>
                            </div>
                            <div className="rounded-lg bg-space-800/60 px-3 py-2 text-center">
                              <p className="text-white font-semibold">{performance.activityCount}</p>
                              <p className="text-muted-foreground">Aportes</p>
                            </div>
                          </div>
                          <div className="rounded-lg border border-space-600 bg-space-800/50 px-3 py-2">
                            <p className="flex items-center gap-2 text-xs font-medium text-white">
                              <History className="w-3.5 h-3.5 text-cyan-400" />
                              Última actividad
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">{getActivitySummary(performance.lastActivity)}</p>
                          </div>
                        </div>

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

                        {isMaster && !isCurrentUser && (
                          <div className="pt-3 border-t border-space-600">
                            <label className="text-xs text-muted-foreground mb-2 block">Asignar rol:</label>
                            <select
                              value={member.rol || ''}
                              onChange={(event) => {
                                const value = event.target.value as UserRole | ''
                                handleRoleChange(member.id, value ? value as UserRole : undefined)
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

                        {(isMaster || hasRole(user, 'admin')) && !isCurrentUser && (
                          <div className="pt-3 border-t border-space-600">
                            <label className="text-xs text-muted-foreground mb-2 block">Asignar equipos (máx. 2):</label>
                            <div className="space-y-2">
                              {(['tecnico', 'manager', 'relaciones_publicas'] as TeamType[]).map(teamOption => {
                                const checked = member.equipos?.includes(teamOption) ?? false
                                const disabled = !checked && (member.equipos?.length ?? 0) >= 2
                                return (
                                  <label key={teamOption} className={`flex min-h-11 items-center gap-2 rounded-xl border border-space-500 bg-space-600 px-3 py-2 text-sm cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-cyan-500'}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={() => handleTeamToggle(member.id, teamOption, member.equipos || [])}
                                      className="accent-cyan-500"
                                      title={`Asignar equipo ${TEAM_LABELS[teamOption]}`}
                                    />
                                    <span className="text-white">{TEAM_LABELS[teamOption]}</span>
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