import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Rocket,
  FolderKanban,
  Users,
  Clock,
  CheckCircle2,
  ListTodo,
  AlertTriangle,
  Calendar,
  History,
  Trophy,
  Satellite,
  ArrowRight,
} from 'lucide-react'
import { ActivityLogEntry, TeamType, User as UserType, hasTeam, hasRole } from '@/types'
import { ROLE_LABELS, TEAM_LABELS } from '@/lib/ui-constants'
import { WeeklyDigestWidget } from '@/components/dashboard/WeeklyDigestWidget'
import { UserService } from '@/sdk/UserService'
import { ProjectService } from '@/sdk/ProjectService'
import { TaskService } from '@/sdk/TaskService'
import { ActivityLogService } from '@/sdk/ActivityLogService'
import { logger } from '@/lib/logger'
import { extractNameFromEmail } from '@/lib/utils'
import { buildMemberPerformance, getMemberRankInfo } from '@/lib/memberMetrics'
import { TeamTree } from '@/components/dashboard/TeamTree'

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
  const navigate = useNavigate()
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
        const [membersResult, projectsResult, tasksResult, activityResult] = await Promise.allSettled([
          UserService.getAll(),
          ProjectService.getAll(),
          TaskService.getAll(),
          ActivityLogService.getAll(),
        ])

        const members = membersResult.status === 'fulfilled' ? membersResult.value : []
        const projectsListRaw = projectsResult.status === 'fulfilled' ? projectsResult.value : []
        const tasksListRaw = tasksResult.status === 'fulfilled' ? tasksResult.value : []
        const activityLog = activityResult.status === 'fulfilled' ? activityResult.value : []

        if (membersResult.status === 'rejected') logger.error('Error loading dashboard members', { error: membersResult.reason instanceof Error ? membersResult.reason : undefined })
        if (projectsResult.status === 'rejected') logger.error('Error loading dashboard projects', { error: projectsResult.reason instanceof Error ? projectsResult.reason : undefined })
        if (tasksResult.status === 'rejected') logger.error('Error loading dashboard tasks', { error: tasksResult.reason instanceof Error ? tasksResult.reason : undefined })

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
      bg: 'bg-cyan-500/20',
      path: '/projects'
    },
    {
      title: 'Tareas Activas',
      value: loadingStats ? '…' : String(stats.pendingTasks),
      icon: Clock,
      color: 'text-orange-400',
      bg: 'bg-orange-500/20',
      path: '/tasks'
    },
    {
      title: 'Completadas',
      value: loadingStats ? '…' : String(stats.completedTasks),
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/20',
      path: '/tasks'
    },
    {
      title: 'Miembros',
      value: loadingStats ? '…' : String(memberCount.total),
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-500/20',
      path: '/members'
    },
  ]

  const greeting = user?.genero === 'femenino' ? 'Bienvenida' : user?.genero === 'otro' ? 'Bienvenido/a' : 'Bienvenido'
  const displayName = user?.nombre || extractNameFromEmail(user?.email || '')



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

      {/* Módulo de Telemetría Satelital / Estación Terrena Premium */}
      <div className="mb-6 animate-fade-in-up">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-space-850 via-space-800 to-purple-950/20 p-5 sm:p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)] transition-all duration-300 hover:border-cyan-500/30">
          {/* Background ambient glows */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* Satellite Icon Container with Rotating Animation */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 relative group overflow-hidden">
                <Satellite className="h-7 w-7 animate-[spin_40s_linear_infinite] group-hover:text-cyan-300" />
                <div className="absolute inset-0 rounded-xl bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">Centro de Control y Telemetría</h2>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    ESTACIÓN ONLINE
                  </Badge>
                </div>
                <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
                  Consola de seguimiento y enlace en tiempo real para nuestros nanosatélites CubeSat en órbita. Monitorea trayectorias, estado de salud de subsistemas clave (EPS, OBC, ADCS) y recibe descargas de telemetría directo desde nuestra antena de tierra.
                </p>
              </div>
            </div>
            
            <div className="shrink-0">
              <a 
                href="https://ground-station-production-596d.up.railway.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block w-full sm:w-auto"
              >
                <button className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-5 py-3 text-sm font-bold text-space-900 shadow-lg shadow-cyan-500/10 transition-all duration-300 hover:from-cyan-400 hover:to-cyan-500 hover:shadow-cyan-400/25 active:scale-[0.98] sm:w-auto">
                  <span>Conectar Estación</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4" role="region" aria-label="Estadísticas del equipo" aria-live="polite">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card 
              key={stat.title} 
              onClick={() => stat.path && navigate(stat.path)}
              className="bg-space-700/50 border-space-600 hover:bg-space-700/70 hover:border-cyan-500/30 cursor-pointer transition-all duration-300 group"
            >
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

      {(hasTeam(user, 'manager') || hasRole(user, 'admin') || hasRole(user, 'maestro')) && (
        <div className="mt-4 sm:mt-6">
          <WeeklyDigestWidget />
        </div>
      )}

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

      <div className="grid gap-4 lg:grid-cols-1 lg:gap-6 mt-4 lg:mt-6">
        <Card className="bg-space-700/50 border-space-600">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-1 lg:gap-6 mt-4 lg:mt-6">
        <Card className="bg-space-700/50 border-space-600 w-full overflow-hidden">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Estructura del Equipo
            </CardTitle>
            <CardDescription>Red organizativa dinámica del equipo Cubesat</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {loadingStats ? (
              <div className="flex justify-center p-10"><span className="text-muted-foreground">Cargando árbol del equipo...</span></div>
            ) : (
              <TeamTree members={usersList} />
            )}
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