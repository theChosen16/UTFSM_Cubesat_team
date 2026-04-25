import { useState, useEffect, ChangeEvent, useMemo } from 'react'
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
  X,
  Calendar,
  Upload,
  History,
  FileText
} from 'lucide-react'
import { logger } from '@/lib/logger'
import { FileRecord, Task, TaskDeliverable, TaskMilestone, User as UserType, TeamType, hasAnyRole, hasTeam } from '@/types'
import { TEAM_LABELS } from '@/lib/ui-constants'
import { ProjectService } from '@/sdk/ProjectService'
import { TaskService } from '@/sdk/TaskService'
import { UserService } from '@/sdk/UserService'
import { FileService } from '@/sdk/FileService'
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
  const [files, setFiles] = useState<FileRecord[]>([])
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
  const [fechaLimite, setFechaLimite] = useState('')
  const [hitos, setHitos] = useState<TaskMilestone[]>([])
  const [deliverables, setDeliverables] = useState<TaskDeliverable[]>([])

  const [editingTimeTaskId, setEditingTimeTaskId] = useState<string | null>(null)
  const [fechaInicioForm, setFechaInicioForm] = useState('')
  const [fechaFinForm, setFechaFinForm] = useState('')
  const [activeProgressTaskId, setActiveProgressTaskId] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [submittingProgress, setSubmittingProgress] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  const canManageTasks = hasAnyRole(user, 'maestro', 'admin') || hasTeam(user, 'manager')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [tasksResult, projectsResult, usersResult, filesResult] = await Promise.allSettled([
        TaskService.getAll(),
        ProjectService.getAll(),
        UserService.getAll(),
        FileService.getAll(),
      ])

      if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value)
      else logger.error('Error loading tasks', { error: tasksResult.reason instanceof Error ? tasksResult.reason : undefined })

      if (projectsResult.status === 'fulfilled') setProjects(projectsResult.value.map(p => ({ id: p.id, nombre: p.nombre })))
      else logger.error('Error loading projects', { error: projectsResult.reason instanceof Error ? projectsResult.reason : undefined })

      if (usersResult.status === 'fulfilled') setMembers(usersResult.value.map(u => ({ ...u, email: u.email || '' })))
      else logger.error('Error loading users', { error: usersResult.reason instanceof Error ? usersResult.reason : undefined })

      if (filesResult.status === 'fulfilled') setFiles(filesResult.value)
      // files is optional — silent fail is acceptable
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
    setFechaLimite('')
    setHitos([])
    setDeliverables([])
    setShowForm(false)
    setError('')
  }

  const createMilestone = (): TaskMilestone => ({
    id: crypto.randomUUID(),
    titulo: '',
    descripcion: '',
    estado: 'pendiente',
    fechaLimite: '',
  })

  const createDeliverable = (): TaskDeliverable => ({
    id: crypto.randomUUID(),
    titulo: '',
    descripcion: '',
    estado: 'pendiente',
    fechaLimite: '',
    attachmentIds: [],
  })

  const updateMilestone = (milestoneId: string, patch: Partial<TaskMilestone>) => {
    setHitos(prev => prev.map(item => item.id === milestoneId ? { ...item, ...patch } : item))
  }

  const updateDeliverableDraft = (deliverableId: string, patch: Partial<TaskDeliverable>) => {
    setDeliverables(prev => prev.map(item => item.id === deliverableId ? { ...item, ...patch } : item))
  }

  const filesById = useMemo(() => {
    return new Map(files.map(file => [file.id, file]))
  }, [files])

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
        puntajeImportancia,
        fechaLimite: fechaLimite || undefined,
        hitos: hitos
          .filter(item => item.titulo.trim())
          .map(item => ({
            ...item,
            titulo: item.titulo.trim(),
            descripcion: item.descripcion?.trim() || '',
            fechaLimite: item.fechaLimite || undefined,
          })),
        deliverables: deliverables
          .filter(item => item.titulo.trim())
          .map(item => ({
            ...item,
            titulo: item.titulo.trim(),
            descripcion: item.descripcion?.trim() || '',
            fechaLimite: item.fechaLimite || undefined,
            attachmentIds: [],
          })),
        attachmentIds: [],
      })

      await TaskService.create({
        ...validData,
        descripcion: validData.descripcion,
        projectId: validData.projectId,
        puntajeImportancia: validData.puntajeImportancia ?? 5,
        estado: 'pendiente',
        creadoPor: user.id
      })
      resetForm()
      await loadData()
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message ?? 'Error de validación al crear la tarea.')
        return
      }
      logger.error('Error creating task', { error: err })
      setError('Error al crear la tarea. Verifica tus permisos e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: Task['estado']) => {
    if (!user) return
    try {
      const task = tasks.find(item => item.id === taskId)
      await TaskService.updateStatus(taskId, newStatus, { actorId: user.id, task })
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

  const openProgressComposer = (taskId: string) => {
    setActiveProgressTaskId(taskId)
    setProgressMessage('')
  }

  const handleSaveProgress = async (task: Task) => {
    if (!user || !progressMessage.trim()) return
    setSubmittingProgress(true)
    try {
      await TaskService.addProgressUpdate(task.id, {
        authorId: user.id,
        message: progressMessage.trim(),
        status: task.estado,
      })
      setActiveProgressTaskId(null)
      setProgressMessage('')
      await loadData()
    } catch (err) {
      logger.error('Error logging task progress', { error: err, taskId: task.id })
      setError('Error al registrar el avance de la tarea.')
    } finally {
      setSubmittingProgress(false)
    }
  }

  const handleDeliverableUpload = async (task: Task, deliverable: TaskDeliverable, file: File | null) => {
    if (!user || !file) return
    const uploadKey = `${task.id}:${deliverable.id}`
    setUploadingKey(uploadKey)
    setError('')
    try {
      const record = await FileService.upload(file, {
        uploadedBy: user.id,
        taskId: task.id,
        projectId: task.projectId || undefined,
        deliverableId: deliverable.id,
      })

      await TaskService.attachFileToDeliverable(task.id, deliverable.id, record.id, user.id, {
        fileName: file.name,
        actorName: user.nombre || user.email || user.id,
      })
      await loadData()
    } catch (err) {
      logger.error('Error uploading deliverable file', { error: err, taskId: task.id, deliverableId: deliverable.id })
      setError('No se pudo subir el archivo del entregable.')
    } finally {
      setUploadingKey(null)
    }
  }

  const handleApproveDeliverable = async (taskId: string, deliverableId: string) => {
    if (!user) return
    try {
      await TaskService.updateDeliverable(taskId, deliverableId, { estado: 'aprobado' }, user.id)
      await loadData()
    } catch (err) {
      logger.error('Error approving deliverable', { error: err, taskId, deliverableId })
      setError('No se pudo aprobar el entregable.')
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

  const getDeliverableBadge = (status: TaskDeliverable['estado']) => {
    switch (status) {
      case 'pendiente': return 'orange'
      case 'entregado': return 'cyan'
      case 'aprobado': return 'green'
      default: return 'secondary' as const
    }
  }

  const formatDateTime = (value?: string) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getDeliverableFiles = (deliverable: TaskDeliverable) => {
    return (deliverable.attachmentIds || [])
      .map(fileId => filesById.get(fileId))
      .filter((file): file is FileRecord => Boolean(file))
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
    const isOverdue = Boolean(task.fechaLimite) && task.estado !== 'completado' && new Date(task.fechaLimite as string).getTime() < Date.now()
    const progressUpdates = [...(task.progressUpdates || [])].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

    return (
      <Card key={task.id} className="bg-space-700/50 border-space-600 hover:border-space-500 transition-all duration-200">
        <CardContent className="space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
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
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:gap-4">
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
                {task.fechaLimite && (
                  <span className={`flex items-center gap-1 whitespace-nowrap ${isOverdue ? 'text-red-400' : 'text-cyan-400'}`}>
                    <Calendar className="w-3 h-3" />
                    Plazo: <span className="text-white">{formatDateTime(task.fechaLimite)}</span>
                  </span>
                )}
                {task.tiempoInvertido && (
                  <span className="flex items-center gap-1 text-cyan-400 whitespace-nowrap"><Clock className="w-3 h-3" /> Tiempo: <span className="text-white">{task.tiempoInvertido}</span></span>
                )}
              </div>
            </div>
            {canChangeStatus && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-shrink-0 sm:items-end">
                <select
                  value={task.estado}
                  onChange={(e) => handleStatusChange(task.id, e.target.value as Task['estado'])}
                  title="Cambiar estado de la tarea"
                  className="min-h-11 w-full rounded-xl border border-space-500 bg-space-600 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:w-auto sm:text-sm"
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

          {(task.hitos?.length || 0) > 0 && (() => {
            const total = task.hitos!.length
            const done = task.hitos!.filter(h => h.estado === 'completado').length
            const pct = total === 0 ? 0 : Math.round((done / total) * 100)
            return (
              <div className="rounded-xl border border-space-600 bg-space-800/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <ListTodo className="h-4 w-4 text-cyan-400" />
                    Hitos
                  </div>
                  <span className="text-xs text-muted-foreground">{done}/{total} completados</span>
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-space-600">
                  <div className={`h-full rounded-full bg-cyan-500 transition-all duration-500 ${
                    pct === 0 ? 'w-0' : pct <= 16 ? 'w-1/6' : pct <= 25 ? 'w-1/4' : pct <= 33 ? 'w-1/3' :
                    pct <= 50 ? 'w-1/2' : pct <= 66 ? 'w-2/3' : pct <= 75 ? 'w-3/4' : pct < 100 ? 'w-5/6' : 'w-full'
                  }`} />
                </div>
                <div className="space-y-2">
                  {task.hitos?.map(hito => (
                    <div key={hito.id} className="flex items-start gap-3 rounded-lg border border-space-600/70 bg-space-700/40 px-3 py-2">
                      <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${hito.estado === 'completado' ? 'border-green-500 bg-green-500/20' : 'border-space-400'}`}>
                        {hito.estado === 'completado' && <div className="h-1.5 w-1.5 rounded-full bg-green-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${hito.estado === 'completado' ? 'text-muted-foreground line-through' : 'text-white'}`}>{hito.titulo}</p>
                        {hito.descripcion && <p className="text-xs text-muted-foreground">{hito.descripcion}</p>}
                        {hito.fechaLimite && (
                          <p className="mt-0.5 text-xs text-muted-foreground">Plazo: {formatDateTime(hito.fechaLimite)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {(task.deliverables?.length || 0) > 0 && (
            <div className="rounded-xl border border-space-600 bg-space-800/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                <FileText className="h-4 w-4 text-orange-400" />
                Buzón de entregables
              </div>
              <div className="space-y-3">
                {task.deliverables?.map(deliverable => {
                  const deliverableFiles = getDeliverableFiles(deliverable)
                  const currentUploadKey = `${task.id}:${deliverable.id}`
                  return (
                    <div key={deliverable.id} className="rounded-lg border border-space-600/70 bg-space-700/40 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white">{deliverable.titulo}</p>
                            <Badge variant={getDeliverableBadge(deliverable.estado) as 'orange' | 'cyan' | 'green'}>
                              {deliverable.estado === 'aprobado' ? 'Aprobado' : deliverable.estado === 'entregado' ? 'Entregado' : 'Pendiente'}
                            </Badge>
                          </div>
                          {deliverable.descripcion && <p className="mt-1 text-xs text-muted-foreground">{deliverable.descripcion}</p>}
                          {deliverable.fechaLimite && (
                            <p className="mt-1 text-xs text-muted-foreground">Plazo: {formatDateTime(deliverable.fechaLimite)}</p>
                          )}
                        </div>
                        {canManageTasks && deliverable.estado === 'entregado' && (
                          <Button size="sm" onClick={() => handleApproveDeliverable(task.id, deliverable.id)} className="bg-green-500 text-space-900 hover:bg-green-600">
                            Aprobar
                          </Button>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {deliverableFiles.length > 0 ? (
                          deliverableFiles.map(file => (
                            <a
                              key={file.id}
                              href={file.downloadURL}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              <span>{file.name}</span>
                            </a>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">Aún no hay archivos subidos para este entregable.</p>
                        )}
                      </div>

                      {canChangeStatus && (
                        <div className="mt-3">
                          <label className="mb-1 flex items-center gap-2 text-xs text-slate-300">
                            <Upload className="h-3.5 w-3.5 text-cyan-400" />
                            Subir evidencia o entregable
                          </label>
                          <Input
                            type="file"
                            className="bg-space-700 border-space-500 text-white"
                            disabled={uploadingKey === currentUploadKey}
                            onChange={(event) => handleDeliverableUpload(task, deliverable, event.target.files?.[0] || null)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(progressUpdates.length > 0 || canChangeStatus) && (
            <div className="rounded-xl border border-space-600 bg-space-800/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <History className="h-4 w-4 text-purple-400" />
                  Historial de avance
                  {progressUpdates.length > 0 && (
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">{progressUpdates.length}</span>
                  )}
                </div>
                {canChangeStatus && activeProgressTaskId !== task.id && (
                  <Button variant="ghost" size="sm" onClick={() => openProgressComposer(task.id)} className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
                    + Registrar avance
                  </Button>
                )}
              </div>

              {activeProgressTaskId === task.id && (
                <div className="mb-4 space-y-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                  <Textarea
                    value={progressMessage}
                    onChange={handleInputChange(setProgressMessage)}
                    placeholder="Describe qué hiciste, bloqueo actual o próximo paso..."
                    className="bg-space-700 border-space-500 text-white min-h-[80px]"
                    autoFocus
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setActiveProgressTaskId(null)} className="border-space-600 text-white hover:bg-space-600">
                      Cancelar
                    </Button>
                    <Button onClick={() => handleSaveProgress(task)} disabled={!progressMessage.trim() || submittingProgress} className="bg-cyan-500 text-space-900 hover:bg-cyan-600">
                      {submittingProgress ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              )}

              {progressUpdates.length > 0 ? (
                <div className="space-y-2">
                  {progressUpdates.slice(0, 3).map(update => (
                    <div key={update.id} className="rounded-lg border border-space-600/70 bg-space-700/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-white">{getMemberName(update.authorId)}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatDateTime(update.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-200">{update.message}</p>
                      {update.status && (
                        <p className="mt-1 text-[11px] text-purple-300">Estado: {getStatusLabel(update.status)}</p>
                      )}
                    </div>
                  ))}
                  {progressUpdates.length > 3 && (
                    <p className="text-center text-xs text-muted-foreground">y {progressUpdates.length - 3} avance{progressUpdates.length - 3 !== 1 ? 's' : ''} más...</p>
                  )}
                </div>
              ) : canChangeStatus ? (
                <p className="text-sm text-muted-foreground">Aún no hay avances registrados. Usa el botón de arriba para añadir el primero.</p>
              ) : null}
            </div>
          )}

          {/* Time Tracking Inline Form */}
          {editingTimeTaskId === task.id && (
            <div className="mt-4 p-4 rounded-lg bg-space-800/80 border border-space-600 space-y-3 animate-fade-in-up">
              <h4 className="text-sm font-medium text-white flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-400" /> Registrar Calendario Real</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    <div className="page-shell">
      {/* Header */}
      <div className="page-header animate-fade-in-up">
        <div>
          <h1 className="page-title">Gestión de Tareas</h1>
          <p className="page-copy">
            Crea y administra las tareas del equipo
          </p>
        </div>
        {canManageTasks && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="w-full bg-cyan-500 text-space-900 hover:bg-cyan-600 sm:w-auto"
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
            <div className="flex items-start justify-between gap-3">
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

            <div className="space-y-2">
              <label htmlFor="task-deadline" className="text-sm font-medium text-white">Plazo</label>
              <Input
                id="task-deadline"
                type="datetime-local"
                value={fechaLimite}
                onChange={handleInputChange(setFechaLimite)}
                className="bg-space-700 border-space-500 text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="task-project" className="text-sm font-medium text-white">Proyecto</label>
                <select
                  id="task-project"
                  value={projectId}
                  onChange={handleInputChange(setProjectId)}
                  title="Seleccionar proyecto"
                  className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
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
                  className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
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
                  className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>

              {canManageTasks && (
                <div className="space-y-2 sm:col-span-2 xl:col-span-3">
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
              <div className="touch-scroll flex max-h-[220px] flex-wrap gap-2 overflow-y-auto rounded-xl border border-space-500 bg-space-700 p-3">
                {members.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={`min-h-11 rounded-full px-3 py-2 text-left text-sm transition-colors ${
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

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-space-600 bg-space-800/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white">Hitos de la tarea</h3>
                    <p className="text-xs text-muted-foreground">Divide la tarea en pasos internos trazables.</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setHitos(prev => [...prev, createMilestone()])} className="text-cyan-400 hover:text-cyan-300">
                    <Plus className="mr-1 h-4 w-4" /> Agregar
                  </Button>
                </div>

                {hitos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay hitos definidos todavía.</p>
                ) : (
                  <div className="space-y-3">
                    {hitos.map(hito => (
                      <div key={hito.id} className="rounded-lg border border-space-600/70 bg-space-700/40 p-3 space-y-2">
                        <Input
                          value={hito.titulo}
                          onChange={(event) => updateMilestone(hito.id, { titulo: event.target.value })}
                          placeholder="Nombre del hito"
                          className="bg-space-700 border-space-500 text-white"
                        />
                        <Textarea
                          value={hito.descripcion || ''}
                          onChange={(event) => updateMilestone(hito.id, { descripcion: event.target.value })}
                          placeholder="Detalle opcional del hito"
                          className="bg-space-700 border-space-500 text-white min-h-[70px]"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            type="datetime-local"
                            value={hito.fechaLimite || ''}
                            onChange={(event) => updateMilestone(hito.id, { fechaLimite: event.target.value })}
                            className="bg-space-700 border-space-500 text-white"
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setHitos(prev => prev.filter(item => item.id !== hito.id))} className="text-red-400 hover:text-red-300">
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-space-600 bg-space-800/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white">Entregables y evidencias</h3>
                    <p className="text-xs text-muted-foreground">Define qué archivos o resultados deben entregarse.</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDeliverables(prev => [...prev, createDeliverable()])} className="text-cyan-400 hover:text-cyan-300">
                    <Plus className="mr-1 h-4 w-4" /> Agregar
                  </Button>
                </div>

                {deliverables.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay entregables definidos todavía.</p>
                ) : (
                  <div className="space-y-3">
                    {deliverables.map(deliverable => (
                      <div key={deliverable.id} className="rounded-lg border border-space-600/70 bg-space-700/40 p-3 space-y-2">
                        <Input
                          value={deliverable.titulo}
                          onChange={(event) => updateDeliverableDraft(deliverable.id, { titulo: event.target.value })}
                          placeholder="Nombre del entregable"
                          className="bg-space-700 border-space-500 text-white"
                        />
                        <Textarea
                          value={deliverable.descripcion || ''}
                          onChange={(event) => updateDeliverableDraft(deliverable.id, { descripcion: event.target.value })}
                          placeholder="Ejemplo: PDF del informe, foto del prototipo, planilla de ensayo..."
                          className="bg-space-700 border-space-500 text-white min-h-[70px]"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            type="datetime-local"
                            value={deliverable.fechaLimite || ''}
                            onChange={(event) => updateDeliverableDraft(deliverable.id, { fechaLimite: event.target.value })}
                            className="bg-space-700 border-space-500 text-white"
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDeliverables(prev => prev.filter(item => item.id !== deliverable.id))} className="text-red-400 hover:text-red-300">
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={resetForm}
                className="w-full border-space-600 text-white hover:bg-space-600 sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateTask}
                disabled={!titulo.trim() || saving}
                className="w-full bg-cyan-500 text-space-900 hover:bg-cyan-600 sm:w-auto"
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
