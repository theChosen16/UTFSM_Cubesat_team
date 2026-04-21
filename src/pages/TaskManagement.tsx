import { useState, useEffect, ChangeEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Plus,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  X
} from 'lucide-react'
import { logger } from '@/lib/logger'
import { Task, User as UserType, TeamType, hasAnyRole, hasTeam } from '@/types'
import { TEAM_LABELS } from '@/lib/ui-constants'
import { TaskService } from '@/sdk/TaskService'
import { UserService } from '@/sdk/UserService'
import { taskFormSchema } from '@/lib/schemas'
import { z } from 'zod'

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
  const [equipo, setEquipo] = useState<TeamType | ''>('tecnico')
  const [asignadoA, setAsignadoA] = useState<string[]>([])
  const [prioridad, setPrioridad] = useState<'alta' | 'media' | 'baja'>('media')
  const [puntajeImportancia, setPuntajeImportancia] = useState<number>(5)

  const [editingTimeTaskId, setEditingTimeTaskId] = useState<string | null>(null)
  const [fechaInicioForm, setFechaInicioForm] = useState('')
  const [fechaFinForm, setFechaFinForm] = useState('')

  const canManageTasks = hasAnyRole(user, 'maestro', 'admin') || hasTeam(user, 'manager')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [tasksList, projectsList, usersList] = await Promise.all([
        TaskService.getAll(),
        ProjectService.getAll(),
        UserService.getAll(),
      ])

      setTasks(tasksList)
      setProjects(projectsList.map(p => ({ id: p.id, nombre: p.nombre })))
      setMembers(usersList.map(u => ({ ...u, email: u.email || '' })))
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
    setEquipo('tecnico')
    setAsignadoA([])
    setPrioridad('media')
    setPuntajeImportancia(5)
    setShowForm(false)
    setError('')
  }

  const handleCreateTask = async () => {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      const validData = taskFormSchema.parse({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        projectId: projectId || undefined,
        equipo,
        asignadoA,
        prioridad,
        puntajeImportancia
      })

      await TaskService.create({
        ...validData,
        puntajeImportancia: validData.puntajeImportancia || 5,
        estado: 'pendiente',
        creadoPor: user.id
      })
      resetForm()
      await loadData()
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message)
        return
      }
      logger.error('Error creating task', { error: err })
      setError('Error al crear la tarea. Verifica tus permisos e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: Task['estado']) => {
    try {
      await TaskService.updateStatus(taskId, newStatus)
      await loadData()
    } catch (err) {
      logger.error('Error updating task status', { error: err })
      setError('Error al actualizar el estado de la tarea.')
    }
  }

  const calculateDaysInvertidos = (inicio: string, fin: string) => {
    if (!inicio || !fin) return ''
    const dateInicio = new Date(inicio)
    const dateFin = new Date(fin)
    const diff = dateFin.getTime() - dateInicio.getTime()
    if (diff < 0) return 'Fechas inválidas'
    const diffDays = Math.ceil(diff / (1000 * 3600 * 24))
    if (diffDays === 0) return 'Menos de 1 día'
    return `${diffDays} día${diffDays > 1 ? 's' : ''}`
  }

  const handleSaveTime = async (taskId: string) => {
    try {
      const dbTiempo = calculateDaysInvertidos(fechaInicioForm, fechaFinForm)
      await TaskService.updateTime(taskId, fechaInicioForm, fechaFinForm, dbTiempo)
      setEditingTimeTaskId(null)
      await loadData()
    } catch (err) {
      logger.error('Error saving time', { error: err })
      setError('Error al registrar tiempos.')
    }
  }

  const openTimeTracker = (task: Task) => {
    setEditingTimeTaskId(task.id)
    setFechaInicioForm(task.fechaInicioReal || '')
    setFechaFinForm(task.fechaFinReal || '')
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
    return <Spinner />
  }

  const teamTasks = tasks.filter(t => !t.projectId)
  const projectTasks = tasks.filter(t => t.projectId)

  const renderTaskCard = (task: Task) => {
    const isAssigned = user && task.asignadoA.includes(user.id)
    const canChangeStatus = canManageTasks || isAssigned

    return (
      <Card key={task.id} className="bg-space-700/50 border-space-600 hover:border-space-500 transition-all duration-200">
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
                {task.puntajeImportancia !== undefined && task.puntajeImportancia > 0 && (
                  <span className="flex items-center gap-1 text-orange-400">★ Pto: <span className="text-white">{task.puntajeImportancia}/10</span></span>
                )}
                {task.tiempoInvertido && (
                  <span className="flex items-center gap-1 text-cyan-400 whitespace-nowrap"><Clock className="w-3 h-3" /> Tiempo: <span className="text-white">{task.tiempoInvertido}</span></span>
                )}
              </div>
            </div>
            {canChangeStatus && (
              <div className="flex-shrink-0 flex flex-col items-end gap-2">
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
                {isAssigned && editingTimeTaskId !== task.id && (
                  <Button variant="ghost" size="sm" onClick={() => openTimeTracker(task)} className="text-xs text-cyan-400 hover:text-cyan-300 p-0 h-auto">
                    + Reg. Tiempos
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Time Tracking Inline Form */}
          {editingTimeTaskId === task.id && (
            <div className="mt-4 p-4 rounded-lg bg-space-800/80 border border-space-600 space-y-3 animate-fade-in-up">
              <h4 className="text-sm font-medium text-white flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-400" /> Registrar Calendario Real</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Inicio Real</label>
                  <Input type="datetime-local" value={fechaInicioForm} onChange={handleInputChange(setFechaInicioForm)} className="bg-space-700 text-xs h-9 border-space-500 text-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300">Término Real</label>
                  <Input type="datetime-local" value={fechaFinForm} onChange={handleInputChange(setFechaFinForm)} className="bg-space-700 text-xs h-9 border-space-500 text-white" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setEditingTimeTaskId(null)} className="h-8 text-xs text-slate-300 hover:text-white hover:bg-space-600">Cancelar</Button>
                <Button size="sm" onClick={() => handleSaveTime(task.id)} className="h-8 text-xs bg-cyan-500 hover:bg-cyan-600 text-space-900 font-medium">Guardar Tiempos</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in-up">
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
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm" role="alert">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="task-title" className="text-sm font-medium text-white">Título *</label>
              <Input
                id="task-title"
                value={titulo}
                onChange={handleInputChange(setTitulo)}
                placeholder="Nombre de la tarea"
                className="bg-space-700 border-space-500 text-white"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="task-description" className="text-sm font-medium text-white">Descripción</label>
              <Textarea
                id="task-description"
                value={descripcion}
                onChange={handleInputChange(setDescripcion)}
                placeholder="Describe la tarea en detalle..."
                className="bg-space-700 border-space-500 text-white min-h-[80px]"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label htmlFor="task-project" className="text-sm font-medium text-white">Proyecto</label>
                <select
                  id="task-project"
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
                <label htmlFor="task-team" className="text-sm font-medium text-white">Equipo encargado</label>
                <select
                  id="task-team"
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
                <label htmlFor="task-priority" className="text-sm font-medium text-white">Prioridad</label>
                <select
                  id="task-priority"
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

              {canManageTasks && (
                <div className="space-y-2 md:col-span-3">
                  <label htmlFor="task-points" className="text-sm font-medium text-white flex justify-between items-center mb-1">
                    <span>Puntaje de Importancia</span>
                    <span className="text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded text-xs">{puntajeImportancia}/10</span>
                  </label>
                  <input
                    id="task-points"
                    type="range"
                    min="1"
                    max="10"
                    value={puntajeImportancia}
                    onChange={(e) => setPuntajeImportancia(parseInt(e.target.value))}
                    className="w-full accent-cyan-500 hover:accent-cyan-400 cursor-pointer"
                  />
                  <p className="text-xs text-slate-400">Escala de valor de esta tarea (Asignable solo por Administradores/Managers)</p>
                </div>
              )}
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
      <div className="space-y-8">
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
          <>
            {teamTasks.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  Actividades Puntuales del Equipo
                </h2>
                <div className="grid gap-4">
                  {teamTasks.map(renderTaskCard)}
                </div>
              </div>
            )}

            {projectTasks.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-purple-400" />
                  Tareas de Proyectos
                </h2>
                <div className="grid gap-4">
                  {projectTasks.map(renderTaskCard)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
