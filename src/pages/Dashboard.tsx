import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Rocket, 
  FolderKanban, 
  Users, 
  Cpu, 
  Globe, 
  Clock,
  CheckCircle2
} from 'lucide-react'
import { ROLE_LABELS, TEAM_LABELS, TeamType } from '@/types'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import { extractNameFromEmail } from '@/lib/utils'

interface MemberCount {
  total: number
  byRole: Record<string, number>
  byTeam: Record<string, number>
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
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [usersSnapshot, projectsSnapshot, tasksSnapshot] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'projects')),
          getDocs(collection(db, 'tasks')),
        ])

        const byRole: Record<string, number> = {}
        const byTeam: Record<string, number> = {}
        usersSnapshot.docs.forEach(doc => {
          const data = doc.data()
          const role = data.rol || 'tecnico'
          byRole[role] = (byRole[role] || 0) + 1
          const team = data.equipo
          if (team) {
            byTeam[team] = (byTeam[team] || 0) + 1
          }
        })
        setMemberCount({ total: usersSnapshot.size, byRole, byTeam })

        const activeProjects = projectsSnapshot.docs.filter(d => {
          const estado = d.data().estado || d.data().status
          return estado !== 'completado'
        }).length

        let pendingTasks = 0
        let completedTasks = 0
        tasksSnapshot.docs.forEach(d => {
          const estado = d.data().estado
          if (estado === 'completado') {
            completedTasks++
          } else if (estado === 'pendiente' || estado === 'en_progreso') {
            pendingTasks++
          }
        })

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            ¡{greeting}, {displayName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.roles && user.roles.length > 0 && (
              <>Tu rol: <span className="text-cyan-400">{user.roles.map(r => ROLE_LABELS[r]).join(', ')}</span>{' '}</>  
            )}
            {user?.equipo && (
              <>Equipo: <span className="text-purple-400">{TEAM_LABELS[user.equipo]}</span></>  
            )}
            {(!user?.roles || user.roles.length === 0) && !user?.equipo && (
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
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Rocket className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay proyectos registrados aún.</p>
              <p className="text-sm text-muted-foreground mt-1">Los proyectos aparecerán aquí cuando se creen.</p>
            </div>
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
    </div>
  )
}
