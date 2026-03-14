import { useState, useEffect } from 'react'
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
  Calendar
} from 'lucide-react'
import { ROLE_LABELS, TEAM_LABELS, TeamType } from '@/types'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import { COLLECTIONS } from '@/lib/constants'
import { extractNameFromEmail } from '@/lib/utils'

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
  prioridad: string
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
}

interface DashboardStats {
  activeProjects: number
  pendingTasks: number
  completedTasks: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [memberCount, setMemberCount] = useState<MemberCount>({ total: 0, byRole: {}, byTeam: {} })
  const [stats, setStats] = useState<DashboardStats>({ activeProjects: 0, pendingTasks: 0, completedTasks: 0 })
  const [recentProjects, setRecentProjects] = useState<DashboardProject[]>([])
  const [recentTasks, setRecentTasks] = useState<DashboardTask[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [usersSnapshot, projectsSnapshot, tasksSnapshot] = await Promise.all([
          getDocs(collection(db, COLLECTIONS.USERS)),
          getDocs(collection(db, COLLECTIONS.PROJECTS)),
          getDocs(collection(db, COLLECTIONS.TASKS)),
        ])

        const byRole: Record<string, number> = {}
        const byTeam: Record<string, number> = {}
        usersSnapshot.docs.forEach(doc => {
          const data = doc.data()
          const role = data.rol || (Array.isArray(data.roles) ? data.roles[0] : undefined)
          if (role) {
            byRole[role] = (byRole[role] || 0) + 1
          }
          const teams: string[] = Array.isArray(data.equipos) ? data.equipos : (data.equipo ? [data.equipo] : [])
          teams.forEach(team => {
            byTeam[team] = (byTeam[team] || 0) + 1
          })
        })
        setMemberCount({ total: usersSnapshot.size, byRole, byTeam })

        const activeProjects = projectsSnapshot.docs.filter(d => {
          const estado = d.data().estado || d.data().status
          return estado !== 'completado'
        }).length

        // Store recent projects (up to 4, sorted by creation date)
        const projectsList: DashboardProject[] = projectsSnapshot.docs.map(d => ({
          id: d.id,
          nombre: d.data().nombre || d.data().name || '',
          descripcion: d.data().descripcion || d.data().description || '',
          estado: d.data().estado || d.data().status || 'planificacion',
          prioridad: d.data().prioridad || d.data().priority || 'media',
          fechaLimite: d.data().fechaLimite || d.data().deadline || '',
          progress: d.data().progress || 0,
        }))
        projectsList.sort((a, b) => {
          const order: Record<string, number> = { en_progreso: 0, planificacion: 1, completado: 2 }
          return (order[a.estado] ?? 1) - (order[b.estado] ?? 1)
        })
        setRecentProjects(projectsList.slice(0, 4))

        let pendingTasks = 0
        let completedTasks = 0
        const tasksList: DashboardTask[] = []
        tasksSnapshot.docs.forEach(d => {
          const data = d.data()
          const estado = data.estado
          if (estado === 'completado') {
            completedTasks++
          } else if (estado === 'pendiente' || estado === 'en_progreso') {
            pendingTasks++
          }
          tasksList.push({
            id: d.id,
            titulo: data.titulo || '',
            estado: data.estado || 'pendiente',
            prioridad: data.prioridad || 'media',
            projectId: data.projectId || '',
            equipo: data.equipo || '',
          })
        })
        // Show non-completed tasks first, up to 5
        const activeTasks = tasksList.filter(t => t.estado !== 'completado')
        setRecentTasks(activeTasks.slice(0, 5))

        setStats({ activeProjects, pendingTasks, completedTasks })
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
    const project = recentProjects.find(p => p.id === projectId)
    return project ? project.nombre : ''
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            ¡{greeting}, {displayName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.rol && (
              <>Tu rol: <span className="text-cyan-400">{ROLE_LABELS[user.rol]}</span>{' '}</>  
            )}
            {user?.equipos && user.equipos.length > 0 && (
              <>Equipos: <span className="text-purple-400">{user.equipos.map(t => TEAM_LABELS[t]).join(', ')}</span></>  
            )}
            {!user?.rol && (!user?.equipos || user.equipos.length === 0) && (
              <span className="text-muted-foreground">Sin rol ni equipo asignado</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
            <Rocket className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="bg-space-700/50 border-space-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground truncate">{stat.title}</p>
                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl flex-shrink-0 ${stat.bg}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
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
                  <div key={project.id} className="p-4 rounded-lg bg-space-600/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{project.nombre}</h3>
                      <Badge variant={getStatusVariant(project.estado)}>{getStatusLabel(project.estado)}</Badge>
                    </div>
                    {project.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{project.descripcion}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className={getPriorityColor(project.prioridad)}>
                        Prioridad {project.prioridad}
                      </span>
                      {project.fechaLimite && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {project.fechaLimite}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-space-800 rounded-full h-1.5">
                      <div
                        className="bg-cyan-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Overview */}
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

      {/* Tasks Section */}
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentTasks.map(task => (
                <div key={task.id} className="p-4 rounded-lg bg-space-600/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{task.titulo}</h3>
                    <Badge variant={getStatusVariant(task.estado)}>{getStatusLabel(task.estado)}</Badge>
                  </div>
                  {task.projectId && getProjectNameById(task.projectId) && (
                    <p className="text-xs text-cyan-400 flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" />
                      {getProjectNameById(task.projectId)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {getPriorityIcon(task.prioridad)}
                      <span className={getPriorityColor(task.prioridad)}>Prioridad {task.prioridad}</span>
                    </span>
                    {task.equipo && (
                      <span className="ml-auto text-purple-400">
                        {TEAM_LABELS[task.equipo as TeamType] || task.equipo}
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
  )
}
