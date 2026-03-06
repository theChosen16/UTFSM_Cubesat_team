import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Search, 
  Rocket, 
  Calendar,
  MoreHorizontal,
  Filter
} from 'lucide-react'

export default function Projects() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  const projects = [
    {
      id: '1',
      name: 'Sistema de Comunicación',
      description: 'Desarrollo del sistema de comunicación por radiofrecuencia para el CubeSat.',
      status: 'en_progreso',
      priority: 'alta',
      team: 'tecnico',
      deadline: '2024-06-15',
      progress: 65
    },
    {
      id: '2',
      name: 'Diseño de Estructura',
      description: 'Diseño y análisis estructural del chasis del satélite.',
      status: 'en_progreso',
      priority: 'alta',
      team: 'tecnico',
      deadline: '2024-05-30',
      progress: 40
    },
    {
      id: '3',
      name: 'Campaña Redes Sociales',
      description: 'Planificación de contenido para redes sociales del equipo.',
      status: 'planificacion',
      priority: 'media',
      team: 'relaciones_publicas',
      deadline: '2024-04-01',
      progress: 20
    },
    {
      id: '4',
      name: 'Sistema de Energía',
      description: 'Diseño del sistema de paneles solares y baterías.',
      status: 'planificacion',
      priority: 'alta',
      team: 'tecnico',
      deadline: '2024-07-20',
      progress: 10
    },
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return 'text-red-400'
      case 'media': return 'text-orange-400'
      case 'baja': return 'text-green-400'
      default: return 'text-muted-foreground'
    }
  }

  const canCreateProject = user?.rol === 'maestro' || user?.rol === 'manager'

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Proyectos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona y supervisa los proyectos del equipo
          </p>
        </div>
        {canCreateProject && (
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-space-900">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proyectos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground"
          />
        </div>
        <Button variant="outline" className="border-space-600 text-white hover:bg-space-700">
          <Filter className="w-4 h-4 mr-2" />
          Filtros
        </Button>
      </div>

      {/* Projects Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="bg-space-700/50 border-space-600 hover:border-cyan-500/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-cyan-400" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
              <CardTitle className="text-lg text-white mt-3">{project.name}</CardTitle>
              <CardDescription className="line-clamp-2">{project.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="text-white font-medium">{project.progress}%</span>
                </div>
                <div className="h-2 bg-space-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex items-center justify-between">
                <Badge variant={getStatusColor(project.status) as 'cyan' | 'orange' | 'green'}>
                  {getStatusLabel(project.status)}
                </Badge>
                <span className={`text-sm ${getPriorityColor(project.priority)}`}>
                  Prioridad {project.priority}
                </span>
              </div>

              {/* Deadline */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Fecha límite: {project.deadline}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <Rocket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No se encontraron proyectos</p>
        </div>
      )}
    </div>
  )
}
