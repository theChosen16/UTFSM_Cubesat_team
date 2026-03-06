import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Rocket, 
  FolderKanban, 
  Users, 
  Cpu, 
  Globe, 
  TrendingUp,
  Clock,
  CheckCircle2
} from 'lucide-react'
import { ROLE_LABELS } from '@/types'

export default function Dashboard() {
  const { user } = useAuth()

  const stats = [
    {
      title: 'Proyectos Activos',
      value: '3',
      icon: FolderKanban,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20'
    },
    {
      title: 'Tareas Pendientes',
      value: '12',
      icon: Clock,
      color: 'text-orange-400',
      bg: 'bg-orange-500/20'
    },
    {
      title: 'Completadas',
      value: '28',
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/20'
    },
    {
      title: 'Miembros',
      value: '8',
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-500/20'
    },
  ]

  const recentProjects = [
    { name: 'Sistema de Comunicación', status: 'en_progreso', team: 'tecnico' },
    { name: 'Diseño de Estructura', status: 'en_progreso', team: 'tecnico' },
    { name: 'Campaña Redes Sociales', status: 'planificacion', team: 'relaciones_publicas' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'en_progreso': return 'cyan'
      case 'planificacion': return 'orange'
      case 'completado': return 'green'
      default: return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'en_progreso': return 'En Progreso'
      case 'planificacion': return 'Planificación'
      case 'completado': return 'Completado'
      default: return status
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            ¡Bienvenido, {user?.nombre}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Tu rol: <span className="text-cyan-400">{user ? ROLE_LABELS[user.rol] : ''}</span>
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
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="bg-space-700/50 border-space-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
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
            <div className="space-y-4">
              {recentProjects.map((project) => (
                <div
                  key={project.name}
                  className="flex items-center justify-between p-4 rounded-lg bg-space-600/50 hover:bg-space-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Rocket className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Equipo: {project.team === 'tecnico' ? 'Técnico' : 'Relaciones Públicas'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(project.status) as 'cyan' | 'orange' | 'green'}>
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
              ))}
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
              <div className="flex items-center gap-3 p-3 rounded-lg bg-space-600/50">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Equipo Técnico</p>
                  <p className="text-xs text-muted-foreground">4 miembros</p>
                </div>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-space-600/50">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Manager</p>
                  <p className="text-xs text-muted-foreground">2 miembros</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-space-600/50">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Relaciones Públicas</p>
                  <p className="text-xs text-muted-foreground">2 miembros</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
