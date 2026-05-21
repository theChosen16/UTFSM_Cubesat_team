import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Filter,
  CheckCircle,
  FileDown,
  Clock,
  Sparkles,
  Inbox,
  AlertTriangle,
  UserCheck
} from 'lucide-react'
import { logger } from '@/lib/logger'
import { EventService } from '@/sdk/EventService'
import { TaskService } from '@/sdk/TaskService'
import { CalendarEvent, CalendarEventType, Task, TeamType } from '@/types'
import { cn } from '@/lib/utils'

type ViewType = 'month' | 'agenda'

export default function Calendar() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewType>('month')
  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 21)) // May 2026 to fit the meeting context
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  // Selection states
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date(2026, 4, 21))
  const [filterType, setFilterType] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<'all' | 'events' | 'tasks'>('all')

  // Modal / Add event state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDate, setNewDate] = useState('2026-05-21')
  const [newTime, setNewTime] = useState('20:00')
  const [newType, setNewType] = useState<CalendarEventType>('reunion')
  const [savingEvent, setSavingEvent] = useState(false)

  // Importer states
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [importedCount, setImportedCount] = useState(0)

  // Check permissions
  const isManager = user?.equipos?.includes('manager') || user?.rol === 'maestro' || user?.rol === 'admin'

  // Fetch / Subscribe on mount
  useEffect(() => {
    setLoading(true)
    // Subscribe reactively to events
    const unsubscribeEvents = EventService.subscribeAll(
      (loadedEvents) => {
        setEvents(loadedEvents)
        setLoading(false)
      },
      (error) => {
        logger.error('Error subscribing to calendar events', { error })
        setLoading(false)
      }
    )

    // Load tasks on mount for deadline consolidation
    const loadTasks = async () => {
      try {
        const loadedTasks = await TaskService.getAll()
        setTasks(loadedTasks)
      } catch (error) {
        logger.error('Error loading tasks for calendar deadlines', { error })
      }
    }
    loadTasks()

    return () => {
      unsubscribeEvents()
    }
  }, [])

  // Helper date conversions
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  // Generate calendar days grid
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  
  // Previous month days to pad the grid (Sunday start)
  const prevMonthIndex = month === 0 ? 11 : month - 1
  const prevYearIndex = month === 0 ? year - 1 : year
  const daysInPrevMonth = getDaysInMonth(prevYearIndex, prevMonthIndex)
  const prevMonthPadding = Array.from({ length: firstDay }, (_, i) => {
    const day = daysInPrevMonth - firstDay + i + 1
    return { date: new Date(prevYearIndex, prevMonthIndex, day), isCurrentMonth: false }
  })

  // Current month days
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => {
    return { date: new Date(year, month, i + 1), isCurrentMonth: true }
  })

  // Total grid days (usually 35 or 42)
  const gridDays = [...prevMonthPadding, ...currentMonthDays]
  const remainingCells = 42 - gridDays.length
  const nextMonthIndex = month === 11 ? 0 : month + 1
  const nextYearIndex = month === 11 ? year + 1 : year
  const nextMonthPadding = Array.from({ length: remainingCells }, (_, i) => {
    return { date: new Date(nextYearIndex, nextMonthIndex, i + 1), isCurrentMonth: false }
  })
  
  const allGridDays = [...gridDays, ...nextMonthPadding]

  // Consolidate both tasks and general events into a single timeline array
  const allActivities = [
    ...events.map(ev => ({
      id: ev.id,
      titulo: ev.titulo,
      descripcion: ev.descripcion,
      date: new Date(ev.fechaInicio),
      tipo: ev.tipo,
      todoElDia: ev.todoElDia || false,
      source: 'event' as const,
      creadoPor: ev.creadoPor,
      raw: ev
    })),
    ...tasks
      .filter(t => t.fechaLimite)
      .map(t => {
        // Deadline string in format YYYY-MM-DD
        const [y, m, d] = t.fechaLimite!.split('-').map(Number)
        return {
          id: t.id,
          titulo: `Deadline: ${t.titulo}`,
          descripcion: t.descripcion,
          date: new Date(y, m - 1, d),
          tipo: 'deadline' as const,
          todoElDia: true,
          source: 'task' as const,
          creadoPor: t.creadoPor,
          raw: t
        }
      })
  ]

  // Filter activities
  const filteredActivities = allActivities.filter(act => {
    const typeMatch = filterType === 'all' || act.tipo === filterType
    const sourceMatch =
      filterSource === 'all' ||
      (filterSource === 'events' && act.source === 'event') ||
      (filterSource === 'tasks' && act.source === 'task')
    return typeMatch && sourceMatch
  })

  // Sort activities chronologically
  filteredActivities.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Get activities for a specific day
  const getActivitiesForDate = (date: Date) => {
    return filteredActivities.filter(act => {
      return (
        act.date.getFullYear() === date.getFullYear() &&
        act.date.getMonth() === date.getMonth() &&
        act.date.getDate() === date.getDate()
      )
    })
  }

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // Create Event Handler
  const handleCreateEvent = async () => {
    if (!user || !newTitle.trim()) return
    setSavingEvent(true)
    try {
      const isoDateTime = `${newDate}T${newTime || '12:00'}:00`
      await EventService.create({
        titulo: newTitle.trim(),
        descripcion: newDesc.trim(),
        fechaInicio: isoDateTime,
        tipo: newType,
        creadoPor: user.id
      })
      setShowAddModal(false)
      setNewTitle('')
      setNewDesc('')
      // Refresh selected date activities if needed
      setSelectedDate(new Date(newDate + 'T12:00:00'))
    } catch (error) {
      logger.error('Error creating calendar event', { error })
    } finally {
      setSavingEvent(false)
    }
  }

  // Delete Event Handler
  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta actividad del calendario?')) return
    try {
      await EventService.delete(id)
    } catch (error) {
      logger.error('Error deleting calendar event', { error })
    }
  }

  // Automated Task Importer from 18/05 meeting minutes
  const handleImportMeetingTasks = async () => {
    if (!user || !isManager) return
    setImportStatus('importing')
    try {
      const currentTasks = await TaskService.getAll()
      
      const tasksToImport = [
        {
          titulo: 'Inscripción a CubeDesign 2026',
          descripcion: 'Realizar la inscripción oficial del equipo a la competencia CubeDesign 2026. Quienes aún no estén seguros de participar tienen hasta el viernes 22 para confirmar. La nómina es conversable con la organización.',
          fechaLimite: '2026-05-22',
          prioridad: 'alta' as const,
          equipo: 'manager' as const,
          puntajeImportancia: 10
        },
        {
          titulo: 'Reunión informativa a Postulantes',
          descripcion: 'Preparar y coordinar la sesión informativa online para nuevos postulantes, mostrando qué hace el equipo y las especialidades de cada departamento. Fecha comprometida: Martes 26 de mayo a las 20:00h.',
          fechaLimite: '2026-05-26',
          prioridad: 'alta' as const,
          equipo: 'relaciones_publicas' as const,
          puntajeImportancia: 15
        },
        {
          titulo: 'Lectura de Bases del CubeDesign 2026',
          descripcion: 'IMPORTANTE: Lectura obligatoria de las bases técnicas del CubeDesign 2026 por parte de todos los miembros técnicos para alinear el diseño y requerimientos del nano-satélite.',
          fechaLimite: '2026-05-25',
          prioridad: 'alta' as const,
          equipo: 'tecnico' as const,
          puntajeImportancia: 5
        },
        {
          titulo: 'Enviar fecha de cumpleaños en grupo general',
          descripcion: 'Enviar la fecha de cumpleaños por el grupo general de comunicación para estructurar el registro de efemérides en el Drive y coordinar posts de felicitación en redes.',
          fechaLimite: '2026-05-23',
          prioridad: 'baja' as const,
          equipo: 'relaciones_publicas' as const,
          puntajeImportancia: 2
        },
        {
          titulo: 'Subir foto individual para post en Instagram',
          descripcion: 'Subir una fotografía individual en primer plano al enlace de Drive asignado (https://drive.google.com/drive/folders/1NCEa_vC39Ca6DWuLzOlV-HRtLcmTDSdG?usp=sharing) para el post del equipo actual. Quienes no deseen aparecer, avisar oportunamente.',
          fechaLimite: '2026-05-22',
          prioridad: 'media' as const,
          equipo: 'relaciones_publicas' as const,
          puntajeImportancia: 5
        },
        {
          titulo: 'Definir asignación de departamento anual',
          descripcion: 'Confirmar y unirse al departamento asignado para este año (técnico, relaciones públicas, manager) y agregarse a los canales nuevos correspondientes en la comunidad de comunicación.',
          fechaLimite: '2026-05-24',
          prioridad: 'media' as const,
          equipo: 'tecnico' as const,
          puntajeImportancia: 5
        },
        {
          titulo: 'Coordinar reunión y visita a Casa Central con Anto',
          descripcion: 'Coordinar la agenda de reuniones y la visita física de reconocimiento técnico a Casa Central junto a la docente encargada (Anto).',
          fechaLimite: '2026-05-28',
          prioridad: 'media' as const,
          equipo: 'relaciones_publicas' as const,
          puntajeImportancia: 8
        },
        {
          titulo: 'Subir fotos pendientes de visitas UC y CEN',
          descripcion: 'Recopilar y subir las fotografías de respaldo técnico tomadas durante las visitas a los centros de la Universidad Católica (UC) y el Centro de Estudios Nucleares (CEN) en las carpetas respectivas del Drive.',
          fechaLimite: '2026-05-24',
          prioridad: 'media' as const,
          equipo: 'tecnico' as const,
          puntajeImportancia: 3
        },
        {
          titulo: 'Establecer contacto con Aldonza para alianza',
          descripcion: 'Realizar la llamada o envío de correo formal a Aldonza para estructurar los términos y concretar la alianza del proyecto.',
          fechaLimite: '2026-05-27',
          prioridad: 'alta' as const,
          equipo: 'manager' as const,
          puntajeImportancia: 10
        },
        {
          titulo: 'Coordinar reunión de seguimiento con Varinia',
          descripcion: 'Contactar y agendar una sesión de trabajo presencial/online con Varinia para revisar el estado del plan operativo del semestre.',
          fechaLimite: '2026-05-26',
          prioridad: 'alta' as const,
          equipo: 'manager' as const,
          puntajeImportancia: 10
        }
      ]

      let created = 0
      for (const t of tasksToImport) {
        // Prevent duplication
        const alreadyExists = currentTasks.some(ct => ct.titulo === t.titulo)
        if (!alreadyExists) {
          await TaskService.create({
            projectId: '',
            titulo: t.titulo,
            descripcion: t.descripcion,
            estado: 'pendiente',
            asignadoA: [],
            equipo: t.equipo,
            prioridad: t.prioridad,
            creadoPor: user.id,
            puntajeImportancia: t.puntajeImportancia,
            fechaLimite: t.fechaLimite
          })
          created++
        }
      }

      // Also seed general CubeDesign dates as calendar events
      const generalEvents = [
        {
          titulo: 'Competencia CubeDesign 2026',
          descripcion: 'Fechas oficiales confirmadas para la competencia nacional de CubeDesign 2026.',
          fechaInicio: '2026-11-24T09:00:00',
          fechaFin: '2026-11-27T18:00:00',
          todoElDia: true,
          tipo: 'social' as const,
          creadoPor: user.id
        },
        {
          titulo: 'Reunión Semanal del Equipo CubeSat',
          descripcion: 'Sesión semanal ordinaria de revisión técnica y logística.',
          fechaInicio: '2026-05-18T18:00:00',
          tipo: 'reunion' as const,
          creadoPor: user.id
        }
      ]

      const currentEvents = await EventService.getAll()
      for (const ev of generalEvents) {
        const alreadyExists = currentEvents.some(ce => ce.titulo === ev.titulo)
        if (!alreadyExists) {
          await EventService.create(ev)
        }
      }

      setImportedCount(created)
      setImportStatus('success')

      // Reload tasks state
      const reloadedTasks = await TaskService.getAll()
      setTasks(reloadedTasks)

      setTimeout(() => setImportStatus('idle'), 4000)
    } catch (error) {
      logger.error('Error importing meeting tasks', { error })
      setImportStatus('error')
    }
  }

  // Styling helper for events dot colors
  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'reunion': return 'bg-purple-500 text-purple-200 border-purple-500/30'
      case 'deadline': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'social': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'visita': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
    }
  }

  const getEventDotClass = (type: string) => {
    switch (type) {
      case 'reunion': return 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]'
      case 'deadline': return 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'
      case 'social': return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
      case 'visita': return 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
      default: return 'bg-slate-400'
    }
  }

  if (loading) {
    return <Spinner />
  }

  const selectedDateActivities = selectedDate ? getActivitiesForDate(selectedDate) : []

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header animate-fade-in-up">
        <div>
          <h1 className="page-title">Calendario de Actividades</h1>
          <p className="page-copy">
            Planificación técnica, hitos, reuniones y plazos clave de CubeSat
          </p>
        </div>
        <div className="flex gap-2.5">
          {isManager && (
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-cyan-500 text-space-900 hover:bg-cyan-600 font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Actividad
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Filters and Import Panel */}
        <div className="space-y-4">
          {/* Controls Card */}
          <Card className="bg-space-700/50 border-space-600/70 backdrop-blur-md">
            <CardHeader className="py-4">
              <CardTitle className="text-white flex items-center gap-2 text-base font-semibold">
                <Filter className="w-4 h-4 text-cyan-400" />
                Filtros Activos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <label htmlFor="filter-type" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Evento</label>
                <select
                  id="filter-type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  title="Filtrar por tipo"
                  className="min-h-10 w-full rounded-xl border border-space-500 bg-space-800 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="reunion">Reuniones</option>
                  <option value="deadline">Fechas Límite (Tareas)</option>
                  <option value="visita">Visitas de Estudio</option>
                  <option value="social">Eventos e Hitos</option>
                  <option value="otro">Otros</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="filter-source" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origen de Datos</label>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-space-800 p-1 border border-space-600/55">
                  {(['all', 'events', 'tasks'] as const).map(src => (
                    <button
                      key={src}
                      onClick={() => setFilterSource(src)}
                      className={cn(
                        "rounded-lg py-1.5 text-xs font-medium transition-all",
                        filterSource === src
                          ? "bg-cyan-500/20 text-cyan-400 font-semibold"
                          : "text-muted-foreground hover:text-white"
                      )}
                    >
                      {src === 'all' ? 'Ambos' : src === 'events' ? 'General' : 'Tareas'}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Import Card for Managers */}
          {isManager && (
            <Card className="bg-gradient-to-br from-space-700/50 to-purple-950/20 border-purple-500/20 backdrop-blur-md">
              <CardHeader className="py-4">
                <CardTitle className="text-white flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="w-4.5 h-4.5 text-purple-400 animate-pulse" />
                  Importador de Tareas
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Carga las tareas e hitos de la última reunión del lunes 18/05 de inmediato.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {importStatus === 'success' ? (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-400 text-xs flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">¡Importación Completada!</p>
                      <p className="mt-0.5">Se inicializaron {importedCount} tareas activas y las efemérides en tu base de datos de Firestore.</p>
                    </div>
                  </div>
                ) : importStatus === 'error' ? (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Error al importar</p>
                      <p className="mt-0.5">Ocurrió un error en Firestore. Revisa la consola o los logs para más detalles.</p>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleImportMeetingTasks}
                    disabled={importStatus === 'importing'}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center justify-center gap-2 border border-purple-500/30 shadow-lg shadow-purple-500/10 transition-transform active:scale-98"
                  >
                    {importStatus === 'importing' ? (
                      <>Cargando tareas...</>
                    ) : (
                      <>
                        <FileDown className="w-4 h-4" />
                        Sembrar Tareas Reunión (18/05)
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Selected Date Card */}
          <Card className="bg-space-700/50 border-space-600/70 backdrop-blur-md">
            <CardHeader className="py-4">
              <CardTitle className="text-white text-base font-semibold">
                Actividades: {selectedDate?.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {selectedDateActivities.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground flex flex-col items-center">
                  <Inbox className="w-8 h-8 opacity-40 mb-2" />
                  <p className="text-xs">No hay actividades agendadas para este día.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {selectedDateActivities.map(act => (
                    <div
                      key={act.id}
                      className={cn(
                        "p-3 rounded-xl border bg-space-800/80 transition-all flex flex-col gap-1.5",
                        act.tipo === 'deadline' ? 'border-red-500/20' : 'border-space-600'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white leading-snug">{act.titulo}</p>
                          {act.descripcion && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{act.descripcion}</p>
                          )}
                        </div>
                        {isManager && act.source === 'event' && (
                          <button
                            onClick={() => handleDeleteEvent(act.id)}
                            className="text-muted-foreground hover:text-red-400 p-1"
                            title="Eliminar evento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mt-0.5">
                        <Badge className={cn("text-[9px] px-2 py-0.5", getEventBadgeColor(act.tipo))} variant="secondary">
                          {act.tipo === 'reunion' ? 'Reunión' : act.tipo === 'deadline' ? 'Límite Tarea' : act.tipo === 'social' ? 'Evento' : act.tipo === 'visita' ? 'Visita' : 'Otro'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {act.todoElDia ? 'Todo el día' : act.date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Month View Grid & Switcher */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-space-700/50 border-space-600/70 backdrop-blur-md p-4 sm:p-5">
            {/* Header / Month Switcher */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-space-600/60 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <CalendarIcon className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wide">
                  {currentDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1 rounded-xl bg-space-850 p-1 border border-space-600/50">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-space-700 transition"
                    title="Mes Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date(2026, 4, 21))}
                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-white rounded-lg hover:bg-space-700 transition"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-space-700 transition"
                    title="Siguiente Mes"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex rounded-xl bg-space-850 p-1 border border-space-600/50">
                  <button
                    onClick={() => setView('month')}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-lg transition-all",
                      view === 'month' ? "bg-cyan-500 text-space-900" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    Mes
                  </button>
                  <button
                    onClick={() => setView('agenda')}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-lg transition-all",
                      view === 'agenda' ? "bg-cyan-500 text-space-900" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    Agenda
                  </button>
                </div>
              </div>
            </div>

            {/* View Month */}
            {view === 'month' && (
              <div className="animate-fade-in" role="grid" aria-label="Calendario mensual">
                {/* Days of week */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <div>Dom</div>
                  <div>Lun</div>
                  <div>Mar</div>
                  <div>Mié</div>
                  <div>Jue</div>
                  <div>Vie</div>
                  <div>Sáb</div>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {allGridDays.map((cell, idx) => {
                    const dayActs = getActivitiesForDate(cell.date)
                    const isSelected = selectedDate && 
                      selectedDate.getFullYear() === cell.date.getFullYear() &&
                      selectedDate.getMonth() === cell.date.getMonth() &&
                      selectedDate.getDate() === cell.date.getDate()
                    const isToday = new Date().toDateString() === cell.date.toDateString()

                    return (
                      <button
                        key={`${cell.date.toISOString()}-${idx}`}
                        onClick={() => setSelectedDate(cell.date)}
                        className={cn(
                          "aspect-square p-1 rounded-xl flex flex-col justify-between items-center transition-all border",
                          cell.isCurrentMonth
                            ? "bg-space-800/40 hover:bg-space-800/80 border-space-650/40"
                            : "bg-space-900/20 text-muted-foreground border-transparent opacity-45",
                          isSelected && "border-cyan-500 shadow-[0_0_12px_rgba(34,211,238,0.2)] bg-cyan-900/10",
                          isToday && !isSelected && "border-purple-500 bg-purple-950/10 text-white"
                        )}
                      >
                        {/* Day Number */}
                        <span className={cn(
                          "text-xs font-semibold mt-1",
                          cell.isCurrentMonth ? "text-white" : "text-slate-500"
                        )}>
                          {cell.date.getDate()}
                        </span>

                        {/* Events Dots */}
                        <div className="flex gap-0.5 justify-center flex-wrap max-w-full pb-1 overflow-hidden h-2">
                          {dayActs.slice(0, 3).map(act => (
                            <span
                              key={act.id}
                              className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getEventDotClass(act.tipo))}
                              title={act.titulo}
                            />
                          ))}
                          {dayActs.length > 3 && (
                            <span className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" title="Más actividades" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* View Agenda */}
            {view === 'agenda' && (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 animate-fade-in">
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Inbox className="w-12 h-12 opacity-30 mx-auto mb-4" />
                    <p>No hay eventos programados en este rango.</p>
                  </div>
                ) : (
                  <div className="grid gap-3.5">
                    {filteredActivities.map((act, idx) => (
                      <div
                        key={`${act.id}-${idx}`}
                        className="rounded-xl border border-space-600 bg-space-800/40 p-4 transition-transform hover:translate-x-1 duration-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              {act.date.toLocaleDateString('es-CL', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium bg-space-700 px-2 py-0.5 rounded">
                              {act.todoElDia ? 'Todo el día' : act.date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white">{act.titulo}</h4>
                          {act.descripcion && (
                            <p className="text-xs text-muted-foreground">{act.descripcion}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <Badge className={cn("text-[9px] px-2 py-0.5", getEventBadgeColor(act.tipo))} variant="secondary">
                            {act.tipo === 'reunion' ? 'Reunión' : act.tipo === 'deadline' ? 'Límite Tarea' : act.tipo === 'social' ? 'Evento' : act.tipo === 'visita' ? 'Visita' : 'Otro'}
                          </Badge>
                          {isManager && act.source === 'event' && (
                            <button
                              onClick={() => handleDeleteEvent(act.id)}
                              className="text-muted-foreground hover:text-red-400 transition p-1.5"
                              title="Eliminar evento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md bg-space-850 border-space-600/90 shadow-2xl shadow-cyan-500/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5 text-cyan-400" />
                Nueva Actividad General
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Planifica actividades y publícalas en el calendario del equipo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="evt-title" className="text-xs font-semibold text-white">Título de la Actividad</label>
                <Input
                  id="evt-title"
                  placeholder="Ej: Charla Técnica Cubesat"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-space-800 border-space-600 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="evt-desc" className="text-xs font-semibold text-white">Descripción</label>
                <Textarea
                  id="evt-desc"
                  placeholder="Detalles de la reunión, link de zoom, etc..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="bg-space-800 border-space-600 text-white min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="evt-date" className="text-xs font-semibold text-white">Fecha</label>
                  <Input
                    id="evt-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-space-800 border-space-600 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="evt-time" className="text-xs font-semibold text-white">Hora de Inicio</label>
                  <Input
                    id="evt-time"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-space-800 border-space-600 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="evt-type" className="text-xs font-semibold text-white">Tipo de Evento</label>
                <select
                  id="evt-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as CalendarEventType)}
                  title="Tipo de evento"
                  className="min-h-10 w-full rounded-xl border border-space-600 bg-space-800 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="reunion">Reunión</option>
                  <option value="visita">Visita de Estudio</option>
                  <option value="social">Evento o Hito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreateEvent}
                  disabled={savingEvent || !newTitle.trim()}
                  className="flex-1 bg-cyan-500 text-space-900 hover:bg-cyan-600 font-semibold"
                >
                  {savingEvent ? 'Guardando...' : 'Crear Evento'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 border-space-600 text-white hover:bg-space-800"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
