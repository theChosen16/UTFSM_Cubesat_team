import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { FileRecord, Task, User as UserType, hasAnyRole, hasTeam } from '@/types'
import { FileService } from '@/sdk/FileService'
import { ProjectService } from '@/sdk/ProjectService'
import { sanitizeUrl } from '@/lib/utils'
import { TaskService } from '@/sdk/TaskService'
import { UserService } from '@/sdk/UserService'
import { logger } from '@/lib/logger'
import { AlertTriangle, Calendar, FileText, FolderOpen, Search, Trash2, Upload } from 'lucide-react'

interface ProjectOption {
  id: string
  nombre: string
}

const formatDateTime = (value: Date) => {
  return value.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const getMimeGroup = (mimeType: string) => {
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.startsWith('image/')) return 'Imagen'
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'Planilla'
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return 'Documento'
  return 'Otro'
}

export default function FileRepository() {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileRecord[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [members, setMembers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProjectId, setUploadProjectId] = useState('')
  const [uploadTaskId, setUploadTaskId] = useState('')
  const [inputResetKey, setInputResetKey] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedMimeGroup, setSelectedMimeGroup] = useState('')

  const canManageFiles = hasAnyRole(user, 'maestro', 'admin') || hasTeam(user, 'manager')

  const loadData = useCallback(async () => {
    try {
      const [filesResult, tasksResult, projectsResult, usersResult] = await Promise.allSettled([
        FileService.getAll(),
        TaskService.getAll(),
        ProjectService.getAll(),
        UserService.getAll(),
      ])

      if (filesResult.status === 'fulfilled') setFiles(filesResult.value)
      else logger.error('Error loading files', { error: filesResult.reason instanceof Error ? filesResult.reason : undefined })

      if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value)
      else logger.error('Error loading tasks for file repo', { error: tasksResult.reason instanceof Error ? tasksResult.reason : undefined })

      if (projectsResult.status === 'fulfilled') setProjects(projectsResult.value.map(project => ({ id: project.id, nombre: project.nombre })))
      if (usersResult.status === 'fulfilled') setMembers(usersResult.value.map(member => ({ ...member, email: member.email || '' })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const matchesSearch = searchQuery.trim().length === 0
        || file.name.toLowerCase().includes(searchQuery.toLowerCase())
        || file.mimeType.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesProject = !selectedProjectId || file.projectId === selectedProjectId
      const matchesTask = !selectedTaskId || file.taskId === selectedTaskId
      const matchesMember = !selectedMemberId || file.uploadedBy === selectedMemberId
      const matchesType = !selectedMimeGroup || getMimeGroup(file.mimeType) === selectedMimeGroup
      return matchesSearch && matchesProject && matchesTask && matchesMember && matchesType
    })
  }, [files, searchQuery, selectedProjectId, selectedTaskId, selectedMemberId, selectedMimeGroup])

  const filteredUploadTasks = uploadProjectId
    ? tasks.filter(task => task.projectId === uploadProjectId)
    : tasks

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] || null)
  }

  const getMemberName = (memberId?: string) => {
    if (!memberId) return 'Sin autor'
    const member = members.find(item => item.id === memberId)
    return member ? `${member.nombre || ''} ${member.apellido || ''}`.trim() || member.email : memberId
  }

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'Sin proyecto'
    return projects.find(project => project.id === projectId)?.nombre || projectId
  }

  const getTaskName = (taskId?: string) => {
    if (!taskId) return 'Sin tarea'
    return tasks.find(task => task.id === taskId)?.titulo || taskId
  }

  const handleUpload = async () => {
    if (!user || !selectedFile) return
    if (!user.email) {
      setError('Tu cuenta no tiene un correo institucional registrado.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const linkedTask = tasks.find(task => task.id === uploadTaskId)
      await FileService.upload(selectedFile, {
        uploadedBy: user.id,
        uploadedByEmail: user.email,
        taskId: uploadTaskId || undefined,
        projectId: uploadProjectId || linkedTask?.projectId || undefined,
      })
      setSelectedFile(null)
      setUploadProjectId('')
      setUploadTaskId('')
      setInputResetKey(prev => prev + 1)
      await loadData()
    } catch (uploadError) {
      logger.error('Error uploading repository file', { error: uploadError })
      const message = uploadError instanceof Error ? uploadError.message : 'No se pudo subir el archivo al repertorio.'
      setError(message.includes('drive-bridge-not-configured')
        ? 'El repertorio de archivos aún no está configurado. Pide al maestro habilitar Google Drive.'
        : message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (file: FileRecord) => {
    if (!user?.email) {
      setError('Tu cuenta no tiene un correo institucional registrado.')
      return
    }
    try {
      await FileService.delete(file, { email: user.email })
      await loadData()
    } catch (deleteError) {
      logger.error('Error deleting repository file', { error: deleteError, fileId: file.id })
      setError('No se pudo eliminar el archivo seleccionado.')
    }
  }

  if (loading) {
    return <Spinner />
  }

  const driveBridgeConfigured = FileService.isConfigured()

  return (
    <div className="page-shell">
      <div className="page-header animate-fade-in-up">
        <div>
          <h1 className="page-title">Repertorio de Archivos</h1>
          <p className="page-copy">
            Biblioteca central de evidencias, entregables y documentos respaldada en Google Drive.
          </p>
        </div>
      </div>

      {!driveBridgeConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-400 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-white">El puente con Google Drive no está configurado</p>
            <p className="text-sm text-slate-300">
              Sigue las instrucciones de <code className="rounded bg-space-700 px-1.5 py-0.5 text-xs text-cyan-300">apps-script/README.md</code>{' '}
              para desplegar el script y luego define las variables{' '}
              <code className="rounded bg-space-700 px-1.5 py-0.5 text-xs text-cyan-300">VITE_DRIVE_UPLOAD_URL</code> y{' '}
              <code className="rounded bg-space-700 px-1.5 py-0.5 text-xs text-cyan-300">VITE_DRIVE_UPLOAD_SECRET</code>.
            </p>
          </div>
        </div>
      )}

      <Card className="bg-space-700/50 border-space-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="h-5 w-5 text-cyan-400" />
            Subir archivo al repertorio
          </CardTitle>
          <CardDescription>Asocia el archivo a un proyecto o tarea para mantener la trazabilidad.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">{error}</div>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
            <Input
              key={inputResetKey}
              type="file"
              onChange={handleFileSelect}
              className="bg-space-700 border-space-500 text-white"
            />
            <select
              value={uploadProjectId}
              onChange={(event) => {
                setUploadProjectId(event.target.value)
                setUploadTaskId('')
              }}
              title="Seleccionar proyecto para archivo"
              className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
            >
              <option value="">Sin proyecto</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.nombre}</option>
              ))}
            </select>
            <select
              value={uploadTaskId}
              onChange={(event) => setUploadTaskId(event.target.value)}
              title="Seleccionar tarea para archivo"
              className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
            >
              <option value="">Sin tarea</option>
              {filteredUploadTasks.map(task => (
                <option key={task.id} value={task.id}>{task.titulo}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={!selectedFile || uploading} className="bg-cyan-500 text-space-900 hover:bg-cyan-600">
              {uploading ? 'Subiendo...' : 'Subir al repertorio'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-space-700/50 border-space-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-purple-400" />
            Explorador de archivos
          </CardTitle>
          <CardDescription>Filtra por proyecto, tarea, responsable o tipo de documento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por nombre o tipo..."
                className="bg-space-700 border-space-500 pl-9 text-white"
              />
            </div>
            <select
              value={selectedProjectId}
              onChange={(event) => {
                setSelectedProjectId(event.target.value)
                setSelectedTaskId('')
              }}
              title="Filtrar por proyecto"
              className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
            >
              <option value="">Todos los proyectos</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.nombre}</option>
              ))}
            </select>
            <select
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              title="Filtrar por tarea"
              className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
            >
              <option value="">Todas las tareas</option>
              {tasks
                .filter(task => !selectedProjectId || task.projectId === selectedProjectId)
                .map(task => (
                  <option key={task.id} value={task.id}>{task.titulo}</option>
                ))}
            </select>
            <select
              value={selectedMemberId}
              onChange={(event) => setSelectedMemberId(event.target.value)}
              title="Filtrar por miembro"
              className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
            >
              <option value="">Todos los miembros</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>{getMemberName(member.id)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {['', 'PDF', 'Imagen', 'Planilla', 'Documento', 'Otro'].map(option => (
              <button
                key={option || 'all'}
                type="button"
                onClick={() => setSelectedMimeGroup(option)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${selectedMimeGroup === option ? 'bg-cyan-500 text-space-900' : 'bg-space-700 text-slate-200 hover:bg-space-600'}`}
              >
                {option || 'Todos los tipos'}
              </button>
            ))}
          </div>

          {filteredFiles.length === 0 ? (
            <div className="rounded-xl border border-space-600 bg-space-800/50 px-4 py-8 text-center text-sm text-muted-foreground">
              No hay archivos que coincidan con los filtros actuales.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredFiles.map(file => {
                const canDelete = canManageFiles || user?.id === file.uploadedBy
                return (
                  <Card key={file.id} className="bg-space-800/60 border-space-600">
                    <CardContent className="space-y-3 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="h-4 w-4 text-cyan-400" />
                            {(() => {
                              // La metadata de `files` (incluida viewURL) es escribible por cualquier
                              // miembro vía Firestore; se sanea antes de usarla en un `href`.
                              const safeViewUrl = sanitizeUrl(file.viewURL)
                              return safeViewUrl ? (
                                <a href={safeViewUrl} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-white hover:text-cyan-300">
                                  {file.name}
                                </a>
                              ) : (
                                <span className="truncate text-sm font-medium text-white">{file.name}</span>
                              )
                            })()}
                            <Badge variant="secondary">{getMimeGroup(file.mimeType)}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{file.mimeType} · {formatFileSize(file.size)}</p>
                        </div>
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(file)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                        <p><span className="text-muted-foreground">Proyecto:</span> {getProjectName(file.projectId)}</p>
                        <p><span className="text-muted-foreground">Tarea:</span> {getTaskName(file.taskId)}</p>
                        <p><span className="text-muted-foreground">Subido por:</span> {getMemberName(file.uploadedBy)}</p>
                        <p className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {formatDateTime(file.createdAt)}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}