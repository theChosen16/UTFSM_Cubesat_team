import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Rocket,
  FolderKanban,
  Users,
  Cpu,
  Globe,
  Clock,
  CheckCircle2,
  ListTodo,
  AlertTriangle,
  Calendar,
  History,
  Trophy,
} from 'lucide-react'
import { ActivityLogEntry, TeamType, User as UserType } from '@/types'
import { ROLE_LABELS, TEAM_LABELS } from '@/lib/ui-constants'
import { UserService } from '@/sdk/UserService'
import { ProjectService } from '@/sdk/ProjectService'
import { TaskService } from '@/sdk/TaskService'
import { ActivityLogService } from '@/sdk/ActivityLogService'
import { logger } from '@/lib/logger'
import { extractNameFromEmail } from '@/lib/utils'
import { buildMemberPerformance, getMemberRankInfo } from '@/lib/memberMetrics'

interface MemberCount {
  total: number
  byRole: Record<string, number>
  byTeam: Record<string, number>
}

interface DashboardProject {
  id: string
  nombre: string
  descripcion: string
  estado: string
  fechaLimite: string
  progress: number
}

interface DashboardTask {
  id: string
  titulo: string
  estado: string
  prioridad: string
  projectId: string
  equipo: string
  fechaLimite?: string
  puntajeImportancia?: number
}

interface DashboardStats {
  activeProjects: number
  pendingTasks: number
  completedTasks: number
}

interface LeaderboardEntry {
  member: UserType
  totalScore: number
  completedCount: number
  activityCount: number
}

const formatDateTime = (value?: string | Date) => {
  if (!value) return ''
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Dashboard() {
  const { user } = useAuth()
  const [memberCount, setMemberCount] = useState<MemberCount>({ total: 0, byRole: {}, byTeam: {} })
  const [stats, setStats] = useState<DashboardStats>({ activeProjects: 0, pendingTasks: 0, completedTasks: 0 })
  const [recentProjects, setRecentProjects] = useState<DashboardProject[]>([])
  const [recentTasks, setRecentTasks] = useState<DashboardTask[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([])
  const [usersList, setUsersList] = useState<UserType[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [members, projectsListRaw, tasksListRaw, activityLog] = await Promise.all([
          UserService.getAll(),
          ProjectService.getAll(),
          TaskService.getAll(),
          ActivityLogService.getAll(),
        ])

        setUsersList(members)

        const byRole: Record<string, number> = {}
        const byTeam: Record<string, number> = {}
        members.forEach(member => {
          if (member.rol) {
            byRole[member.rol] = (byRole[member.rol] || 0) + 1
          }
          ;(member.equipos || []).forEach(team => {
            byTeam[team] = (byTeam[team] || 0) + 1
          })
        })
        setMemberCount({ total: members.length, byRole, byTeam })

        const activeProjects = projectsListRaw.filter(project => project.estado !== 'completado').length
        const projectsList: DashboardProject[] = projectsListRaw
          .map(project => {
            const projectTasks = tasksListRaw.filter(task => task.projectId === project.id)
            const completedProjectTasks = projectTasks.filter(task => task.estado === 'completado').length
            const progress = projectTasks.length === 0
              ? (project.estado === 'completado' ? 100 : 0)
              : Math.round((completedProjectTasks / projectTasks.length) * 100)

            return {
              id: project.id,
              nombre: project.nombre,
              descripcion: project.descripcion,
              estado: project.estado,
              fechaLimite: project.fechaLimite ? formatDateTime(project.fechaLimite) : '',
              progress,
            }
          })
          .sort((left, right) => {
            const order: Record<string, number> = { en_progreso: 0, planificacion: 1, completado: 2 }
            return (order[left.estado] ?? 1) - (order[right.estado] ?? 1)
          })
        setRecentProjects(projectsList.slice(0, 4))

        const pendingTasks = tasksListRaw.filter(task => task.estado !== 'completado').length
        const completedTasks = tasksListRaw.filter(task => task.estado === 'completado').length
        const activeTasks = tasksListRaw
          .filter(task => task.estado !== 'completado')
          .sort((left, right) => {
            if (left.fechaLimite && right.fechaLimite) {
              return new Date(left.fechaLimite).getTime() - new Date(right.fechaLimite).getTime()
            }
            if (left.fechaLimite) return -1
            if (right.fechaLimite) return 1
            return (right.puntajeImportancia ?? 0) - (left.puntajeImportancia ?? 0)
          })
          .map(task => ({
            id: task.id,
            titulo: task.titulo,
            estado: task.estado,
            prioridad: task.prioridad,
            projectId: task.projectId,
            equipo: task.equipo,
            fechaLimite: task.fechaLimite,
            puntajeImportancia: task.puntajeImportancia,
          }))
        setRecentTasks(activeTasks.slice(0, 5))
        setStats({ activeProjects, pendingTasks, completedTasks })

        const leaderboardEntries = members
          .map(member => {
            const performance = buildMemberPerformance(member.id, tasksListRaw, activityLog)
            return {
              member,
              totalScore: performance.totalScore,
              completedCount: performance.completedCount,
              activityCount: performance.activityCount,
            }
          })
          .sort((left, right) => {
            if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore
            if (right.completedCount !== left.completedCount) return right.completedCount - left.completedCount
            return right.activityCount - left.activityCount
          })
        setLeaderboard(leaderboardEntries.slice(0, 5))
        setRecentActivity(activityLog.slice(0, 6))
      } catch (error) {
        logger.error('Error loading dashboard stats', { error })
      } finally {
        setLoadingStats(false)
      }
    }

    loadStats()
  }, [])

  const statCards = [
    {
      title: 'Proyectos Activos',
      value: loadingStats ? '…' : String(stats.activeProjects),
      icon: FolderKanban,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20'
    },
    {
      title: 'Tareas Activas',
      value: loadingStats ? '…' : String(stats.pendingTasks),
      icon: Clock,
      color: 'text-orange-400',
      bg: 'bg-orange-500/20'
    },
    {
      title: 'Completadas',
      value: loadingStats ? '…' : String(stats.completedTasks),
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/20'
    },
    {
      title: 'Miembros',
      value: loadingStats ? '…' : String(memberCount.total),
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-500/20'
    },
  ]

  const greeting = user?.genero === 'femenino' ? 'Bienvenida' : user?.genero === 'otro' ? 'Bienvenido/a' : 'Bienvenido'
  const displayName = user?.nombre || extractNameFromEmail(user?.email || '')

  const TEAM_ICON_MAP: Record<TeamType, { icon: typeof Cpu; colorClass: string; bgClass: string }> = {
    tecnico: { icon: Cpu, colorClass: 'text-purple-400', bgClass: 'bg-purple-500/20' },
    manager: { icon: Users, colorClass: 'text-cyan-400', bgClass: 'bg-cyan-500/20' },
    relaciones_publicas: { icon: Globe, colorClass: 'text-green-400', bgClass: 'bg-green-500/20' },
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'en_progreso': return 'cyan' as const
      case 'planificacion': return 'orange' as const
      case 'completado': return 'green' as const
      case 'pendiente': return 'orange' as const
      default: return 'secondary' as const
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'en_progreso': return 'En Progreso'
      case 'planificacion': return 'Planificación'
      case 'completado': return 'Completado'
      case 'pendiente': return 'Pendiente'
      default: return status
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return 'text-red-400'
      case 'media': return 'text-orange-400'
      case 'baja': return 'text-green-400'
      default: return 'text-muted-foreground'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'alta': return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
      case 'media': return <Clock className="w-3.5 h-3.5 text-orange-400" />
      case 'baja': return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
      default: return null
    }
  }

  const getProjectNameById = (projectId: string) => {
    const project = recentProjects.find(item => item.id === projectId)
    return project ? project.nombre : ''
  }

  const getMemberName = (memberId: string) => {
    const member = usersList.find(item => item.id === memberId)
    return member ? `${member.nombre || ''} ${member.apellido || ''}`.trim() || extractNameFromEmail(member.email) : memberId
  }

  return (
    <div className="page-shell">
      <div className="page-header animate-fade-in-up">
        <div>
          <h1 className="page-title">
            ¡{greeting}, {displayName}!
          </h1>
          <p className="page-copy">
            {user?.rol && (
              <>Tu rol: <span className="text-cyan-400">{ROLE_LABELS[user.rol]}</span>{' '}</>
            )}
            {user?.equipos && user.equipos.length > 0 && (
              <>Equipos: <span className="text-purple-400">{user.equipos.map(team => TEAM_LABELS[team]).join(', ')}</span></>
            )}
            {!user?.rol && (!user?.equipos || user.equipos.length === 0) && (
              <span className="text-muted-foreground">Sin rol ni equipo asignado</span>
            )}
          </p>
        </div>
        <div className="page-actions justify-start md:justify-end">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
            <Rocket className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4" role="region" aria-label="Estadísticas del equipo" aria-live="polite">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="bg-space-700/50 border-space-600 hover:bg-space-700/70 transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground truncate">{stat.title}</p>
                    {loadingStats ? (
                      <div className="skeleton h-9 w-16 mt-1" aria-hidden="true" />
                    ) : (
                      <p className="text-3xl font-bold text-white mt-1 animate-fade-in">{stat.value}</p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl flex-shrink-0 ${stat.bg} transition-transform duration-200 hover:scale-110`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card className="bg-space-700/50 border-space-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-400" />
              Ranking del equipo
            </CardTitle>
            <CardDescription>Puntaje acumulado según tareas completadas y aportes registrados.</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay puntajes suficientes para construir el ranking.</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry, index) => {
                  const rank = getMemberRankInfo(entry.totalScore)
                  const isCurrentUser = user?.id === entry.member.id
                  const leaderboardKey = entry.member.id || entry.member.email || `leaderboard-${index}`
                  return (
                    <div key={leaderboardKey} className={`rounded-xl border px-4 py-3 ${isCurrentUser ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-space-600 bg-space-800/50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">#{index + 1} {entry.member.nombre || extractNameFromEmail(entry.member.email)} {entry.member.apellido || ''}</p>
                          <p className="text-xs text-muted-foreground">{entry.completedCount} tareas completadas · {entry.activityCount} actividades</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-orange-300">{entry.totalScore} pts</p>
                          <Badge className={rank.color} variant="secondary">{rank.label}</Badge>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-space-700/50 border-space-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              Historial reciente
            </CardTitle>
            <CardDescription>Quién hizo qué y cuándo dentro del proyecto.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay actividad registrada.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="rounded-xl border border-space-600 bg-space-800/50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{getMemberName(activity.userId)}</p>
                        <p className="mt-1 text-sm text-slate-300">{activity.description}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDateTime(activity.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2 bg-space-700/50 border-space-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-cyan-400" />
              Proyectos Recientes
            </CardTitle>
            <CardDescription>Estado actual de los proyectos del equipo</CardDescription>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Rocket className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay proyectos registrados aún.</p>
                <p className="text-sm text-muted-foreground mt-1">Los proyectos aparecerán aquí cuando se creen.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.map(project => (
                  <div key={project.id} className="space-y-2 rounded-xl bg-space-600/50 p-3.5 transition-colors duration-200 hover:bg-space-600/70 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold text-white sm:truncate">{project.nombre}</h3>
                      <Badge variant={getStatusVariant(project.estado)}>{getStatusLabel(project.estado)}</Badge>
                    </div>
                    {project.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{project.descripcion}</p>
                    )}
                    <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-cyan-300">Progreso estimado {project.progress}%</span>
                      {project.fechaLimite && (
                        <span className="flex items-center gap-1 break-words">
                          <Calendar className="w-3 h-3" />
                          {project.fechaLimite}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-space-700/50 border-space-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Estructura del Equipo
            </CardTitle>
            <CardDescription>Distribución de roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(TEAM_ICON_MAP).map(([team, config]) => {
                const TeamIcon = config.icon
                const count = memberCount.byTeam[team] || 0
                return (
                  <div key={team} className="flex items-center gap-3 p-3 rounded-lg bg-space-600/50">
                    <div className={`w-8 h-8 rounded-lg ${config.bgClass} flex items-center justify-center`}>
                      <TeamIcon className={`w-4 h-4 ${config.colorClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{TEAM_LABELS[team as TeamType]}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {loadingStats ? '…' : `${count} miembro${count !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-space-700/50 border-space-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-orange-400" />
            Tareas Activas
          </CardTitle>
          <CardDescription>Tareas pendientes y en progreso del equipo</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ListTodo className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay tareas activas.</p>
              <p className="text-sm text-muted-foreground mt-1">Las tareas aparecerán aquí cuando se creen.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recentTasks.map(task => (
                <div key={task.id} className="space-y-2 rounded-xl bg-space-600/50 p-3.5 transition-colors duration-200 hover:bg-space-600/70 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-semibold text-white">{task.titulo}</h3>
                    <Badge variant={getStatusVariant(task.estado)}>{getStatusLabel(task.estado)}</Badge>
                  </div>
                  {task.projectId && getProjectNameById(task.projectId) && (
                    <p className="text-xs text-cyan-400 flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" />
                      {getProjectNameById(task.projectId)}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {getPriorityIcon(task.prioridad)}
                      <span className={getPriorityColor(task.prioridad)}>Prioridad {task.prioridad}</span>
                    </span>
                    {task.equipo && (
                      <span className="text-purple-400 sm:ml-auto">
                        {TEAM_LABELS[task.equipo as TeamType] || task.equipo}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {task.fechaLimite && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(task.fechaLimite)}
                      </span>
                    )}
                    {(task.puntajeImportancia ?? 0) > 0 && (
                      <span className="text-orange-300">{task.puntajeImportancia} pts</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}