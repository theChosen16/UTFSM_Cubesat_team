import { useState, useEffect, ChangeEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Search, 
  Rocket, 
  Calendar,
  MoreHorizontal,
  Filter,
  X,
  AlertCircle
} from 'lucide-react'
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import { hasAnyRole, hasTeam } from '@/types'

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
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado] = useState<'planificacion' | 'en_progreso' | 'completado'>('planificacion')
  const [prioridadForm, setPrioridadForm] = useState<'alta' | 'media' | 'baja'>('media')
  const [fechaLimite, setFechaLimite] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

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

  const canCreateProject = hasAnyRole(user, 'maestro', 'admin') || hasTeam(user, 'manager')

  const resetForm = () => {
    setNombre('')
    setDescripcion('')
    setEstado('planificacion')
    setPrioridadForm('media')
    setFechaLimite('')
    setShowForm(false)
    setError('')
  }

  const handleCreateProject = async () => {
    if (!nombre.trim() || !user) return
    setSaving(true)
    setError('')
    try {
      await addDoc(collection(db, 'projects'), {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        estado,
        prioridad: prioridadForm,
        fechaLimite,
        creadoPor: user.id,
        asignadoA: [],
        progress: 0,
        createdAt: Timestamp.now(),
      })
      resetForm()
      await loadProjects()
    } catch (err) {
      logger.error('Error creating project', { error: err })
      setError('Error al crear el proyecto. Verifica tus permisos e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setter(event.target.value)
  }

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
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-cyan-500 hover:bg-cyan-600 text-space-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {/* Create Project Form */}
      {showForm && canCreateProject && (
        <Card className="bg-space-700/50 border-space-600">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Rocket className="w-5 h-5 text-cyan-400" />
                Nuevo Proyecto
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm} className="text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>Completa los campos para crear un nuevo proyecto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Nombre del proyecto *</label>
              <Input
                value={nombre}
                onChange={handleInputChange(setNombre)}
                placeholder="Ej: CubeSat Alpha"
                className="bg-space-700 border-space-500 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Descripción</label>
              <Textarea
                value={descripcion}
                onChange={handleInputChange(setDescripcion)}
                placeholder="Describe el proyecto en detalle..."
                className="bg-space-700 border-space-500 text-white min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as 'planificacion' | 'en_progreso' | 'completado')}
                  title="Seleccionar estado"
                  className="w-full px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="planificacion">Planificación</option>
                  <option value="en_progreso">En Progreso</option>
                  <option value="completado">Completado</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Prioridad</label>
                <select
                  value={prioridadForm}
                  onChange={(e) => setPrioridadForm(e.target.value as 'alta' | 'media' | 'baja')}
                  title="Seleccionar prioridad"
                  className="w-full px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Fecha límite</label>
                <Input
                  type="date"
                  value={fechaLimite}
                  onChange={handleInputChange(setFechaLimite)}
                  className="bg-space-700 border-space-500 text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={resetForm}
                className="border-space-600 text-white hover:bg-space-600"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!nombre.trim() || saving}
                className="bg-cyan-500 hover:bg-cyan-600 text-space-900"
              >
                {saving ? 'Creando...' : 'Crear Proyecto'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all progress-bar-fill"
                    ref={(el) => { if (el) el.style.setProperty('--progress', `${project.progress}%`) }}
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
