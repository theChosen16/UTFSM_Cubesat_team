import { useState, useEffect, ChangeEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  X
} from 'lucide-react'
import { collection, getDocs, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import { Task, User as UserType, TeamType, TEAM_LABELS, hasAnyRole } from '@/types'

interface ProjectOption {
  id: string
  nombre: string
}

export default function TaskManagement() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [members, setMembers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [projectId, setProjectId] = useState('')
  const [equipo, setEquipo] = useState<TeamType | ''>('')
  const [asignadoA, setAsignadoA] = useState<string[]>([])
  const [prioridad, setPrioridad] = useState<'alta' | 'media' | 'baja'>('media')

  const canManageTasks = hasAnyRole(user, 'maestro', 'admin') || user?.equipo === 'manager'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [tasksSnap, projectsSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'tasks')),
        getDocs(collection(db, 'projects')),
        getDocs(collection(db, 'users')),
      ])

      setTasks(tasksSnap.docs.map(d => {
        const data = d.data()
        const rawAsignadoA = data.asignadoA
        const normalizedAsignadoA = Array.isArray(rawAsignadoA)
          ? rawAsignadoA
          : rawAsignadoA ? [rawAsignadoA] : []
        return {
          id: d.id,
          projectId: data.projectId || '',
          titulo: data.titulo || '',
          descripcion: data.descripcion || '',
          estado: data.estado || 'pendiente',
          asignadoA: normalizedAsignadoA,
          equipo: data.equipo || 'software',
          prioridad: data.prioridad || 'media',
          creadoPor: data.creadoPor || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Task
      }))

      setProjects(projectsSnap.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre || d.data().name || 'Sin nombre',
      })))

      setMembers(membersSnap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          email: data.email || '',
          nombre: data.nombre || '',
          apellido: data.apellido || '',
          roles: Array.isArray(data.roles) ? data.roles : (data.rol ? [data.rol] : []),
          equipo: data.equipo || undefined,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          isActive: data.isActive ?? true,
        } as UserType
      }))
    } catch (error) {
      logger.error('Error loading task management data', { error })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitulo('')
    setDescripcion('')
    setProjectId('')
    setEquipo('')
    setAsignadoA([])
    setPrioridad('media')
    setShowForm(false)
    setError('')
  }

  const handleCreateTask = async () => {
    if (!titulo.trim() || !user) return
    setSaving(true)
    setError('')
    try {
      await addDoc(collection(db, 'tasks'), {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        projectId,
        equipo,
        asignadoA,
        prioridad,
        estado: 'pendiente',
        creadoPor: user.id,
        createdAt: Timestamp.now(),
      })
      resetForm()
      await loadData()
    } catch (err) {
      logger.error('Error creating task', { error: err })
      setError('Error al crear la tarea. Verifica tus permisos e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: Task['estado']) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { estado: newStatus })
      await loadData()
    } catch (err) {
      logger.error('Error updating task status', { error: err })
      setError('Error al actualizar el estado de la tarea.')
    }
  }

  const toggleMember = (memberId: string) => {
    setAsignadoA(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    )
  }

  const getMemberName = (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    return member ? `${member.nombre || ''} ${member.apellido || ''}`.trim() || memberId : memberId
  }

  const getProjectName = (pId: string) => {
    const project = projects.find(p => p.id === pId)
    return project ? project.nombre : 'Sin proyecto'
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'alta': return <AlertTriangle className="w-4 h-4 text-red-400" />
      case 'media': return <Clock className="w-4 h-4 text-orange-400" />
      case 'baja': return <CheckCircle2 className="w-4 h-4 text-green-400" />
      default: return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendiente': return 'orange'
      case 'en_progreso': return 'cyan'
      case 'completado': return 'green'
      default: return 'secondary' as const
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pendiente': return 'Pendiente'
      case 'en_progreso': return 'En Progreso'
      case 'completado': return 'Completado'
      default: return status
    }
  }

  const handleInputChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setter(event.target.value)
  }

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
          <h1 className="text-3xl font-bold text-white">Gestión de Tareas</h1>
          <p className="text-muted-foreground mt-1">
            Crea y administra las tareas del equipo
          </p>
        </div>
        {canManageTasks && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-cyan-500 hover:bg-cyan-600 text-space-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Tarea
          </Button>
        )}
      </div>

      {/* Create Task Form */}
      {showForm && canManageTasks && (
        <Card className="bg-space-700/50 border-space-600">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-cyan-400" />
                Nueva Tarea
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={resetForm} className="text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>Completa los campos para crear una nueva tarea</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Título *</label>
              <Input
                value={titulo}
                onChange={handleInputChange(setTitulo)}
                placeholder="Nombre de la tarea"
                className="bg-space-700 border-space-500 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Descripción</label>
              <Textarea
                value={descripcion}
                onChange={handleInputChange(setDescripcion)}
                placeholder="Describe la tarea en detalle..."
                className="bg-space-700 border-space-500 text-white min-h-[80px]"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Proyecto</label>
                <select
                  value={projectId}
                  onChange={handleInputChange(setProjectId)}
                  title="Seleccionar proyecto"
                  className="w-full px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Sin proyecto</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Equipo encargado</label>
                <select
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value as TeamType | '')}
                  title="Seleccionar equipo"
                  className="w-full px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Seleccionar equipo</option>
                  {Object.entries(TEAM_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Prioridad</label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as 'alta' | 'media' | 'baja')}
                  title="Seleccionar prioridad"
                  className="w-full px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>

            {/* Member Assignment */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Responsable(s)</label>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-space-700 border border-space-500 max-h-[200px] overflow-y-auto">
                {members.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      asignadoA.includes(member.id)
                        ? 'bg-cyan-500 text-space-900 font-medium'
                        : 'bg-space-600 text-muted-foreground hover:bg-space-500 hover:text-white'
                    }`}
                  >
                    {member.nombre || ''} {member.apellido || ''}
                  </button>
                ))}
              </div>
              {asignadoA.length > 0 && (
                <p className="text-xs text-cyan-400">
                  {asignadoA.length} persona{asignadoA.length > 1 ? 's' : ''} seleccionada{asignadoA.length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={resetForm}
                className="border-space-600 text-white hover:bg-space-600"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateTask}
                disabled={!titulo.trim() || saving}
                className="bg-cyan-500 hover:bg-cyan-600 text-space-900"
              >
                {saving ? 'Creando...' : 'Crear Tarea'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      <div className="grid gap-4">
        {tasks.length === 0 ? (
          <Card className="bg-space-700/50 border-space-600">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ListTodo className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay tareas registradas aún.</p>
              {canManageTasks && (
                <p className="text-sm text-muted-foreground mt-1">
                  Usa el botón &quot;Nueva Tarea&quot; para crear la primera tarea.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          tasks.map(task => (
            <Card key={task.id} className="bg-space-700/50 border-space-600">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate max-w-full sm:max-w-none">{task.titulo}</h3>
                      <Badge variant={getStatusBadge(task.estado) as 'orange' | 'cyan' | 'green'}>
                        {getStatusLabel(task.estado)}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {getPriorityIcon(task.prioridad)}
                        <span className="text-xs text-muted-foreground capitalize">{task.prioridad}</span>
                      </div>
                    </div>
                    {task.descripcion && (
                      <p className="text-sm text-muted-foreground">{task.descripcion}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {task.projectId && (
                        <span>Proyecto: <span className="text-white">{getProjectName(task.projectId)}</span></span>
                      )}
                      {task.equipo && (
                        <span>Equipo: <span className="text-white">{TEAM_LABELS[task.equipo] || task.equipo}</span></span>
                      )}
                      {task.asignadoA.length > 0 && (
                        <span>Responsable(s): <span className="text-white">{task.asignadoA.map(getMemberName).join(', ')}</span></span>
                      )}
                    </div>
                  </div>
                  {canManageTasks && (
                    <div className="flex-shrink-0">
                      <select
                        value={task.estado}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as Task['estado'])}
                        title="Cambiar estado de la tarea"
                        className="px-3 py-2 rounded-lg bg-space-600 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_progreso">En Progreso</option>
                        <option value="completado">Completado</option>
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
