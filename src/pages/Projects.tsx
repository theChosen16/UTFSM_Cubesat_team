import { useState, useEffect } from 'react'
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
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'

interface ProjectData {
  id: string
  name: string
  description: string
  status: string
  priority: string
  team: string
  deadline: string
  progress: number
}

export default function Projects() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsSnapshot = await getDocs(collection(db, 'projects'))
        const loadedProjects = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().nombre || doc.data().name || '',
          description: doc.data().descripcion || doc.data().description || '',
          status: doc.data().estado || doc.data().status || 'planificacion',
          priority: doc.data().prioridad || doc.data().priority || 'media',
          team: doc.data().team || 'tecnico',
          deadline: doc.data().fechaLimite || doc.data().deadline || '',
          progress: doc.data().progress || 0,
        }))
        setProjects(loadedProjects)
      } catch (error) {
        logger.error('Error loading projects', { error })
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])

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

  const canCreateProject = user?.rol === 'maestro' || user?.rol === 'admin' || user?.equipo === 'manager'

  const filteredProjects = projects.filter(project =>
    (project.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.description || '').toLowerCase().includes(searchQuery.toLowerCase())
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

      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && (
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
      )}

      {!loading && filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <Rocket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {projects.length === 0 ? 'No hay proyectos registrados aún.' : 'No se encontraron proyectos'}
          </p>
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground mt-1">Los proyectos aparecerán aquí cuando se creen.</p>
          )}
        </div>
      )}
    </div>
  )
}
