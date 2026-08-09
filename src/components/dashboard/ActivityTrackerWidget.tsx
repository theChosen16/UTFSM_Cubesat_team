import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  Clock,
  CheckCircle2,
  PlayCircle,
  FolderKanban,
  Users,
  Search,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Layers,
  Sparkles,
  MessageSquareText,
} from 'lucide-react'
import { Task, TeamType, User as UserType, ActivityLogEntry } from '@/types'
import { TEAM_LABELS } from '@/lib/ui-constants'
import { extractNameFromEmail } from '@/lib/utils'

interface ActivityTrackerWidgetProps {
  tasks: Task[]
  users: UserType[]
  projects: { id: string; nombre: string }[]
  recentLogs?: ActivityLogEntry[]
}

type StatusFilter = 'all' | 'en_progreso' | 'pendiente' | 'completado'
type TeamFilter = 'all' | TeamType

const SUBTEAM_CONFIG: Record<TeamType, { label: string; bg: string; text: string; border: string }> = {
  tecnico: {
    label: 'Equipo Técnico',
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
  },
  manager: {
    label: 'Manager / Gestión',
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-300',
    border: 'border-cyan-500/30',
  },
  relaciones_publicas: {
    label: 'Relaciones Públicas',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
  },
}

export function ActivityTrackerWidget({ tasks, users, projects, recentLogs: _recentLogs = [] }: ActivityTrackerWidgetProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Map users for fast lookup
  const userMap = useMemo(() => {
    const map = new Map<string, UserType>()
    users.forEach(u => map.set(u.id, u))
    return map
  }, [users])

  // Map projects for fast lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach(p => map.set(p.id, p.nombre))
    return map
  }, [projects])

  // Counts by status
  const counts = useMemo(() => {
    return {
      total: tasks.length,
      en_progreso: tasks.filter(t => t.estado === 'en_progreso').length,
      pendiente: tasks.filter(t => t.estado === 'pendiente').length,
      completado: tasks.filter(t => t.estado === 'completado').length,
    }
  }, [tasks])

  // Filter tasks based on selected tab, sub-team, and search string
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Filter by status
      if (statusFilter !== 'all' && task.estado !== statusFilter) return false

      // Filter by sub-team
      if (teamFilter !== 'all' && task.equipo !== teamFilter) return false

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const titleMatch = task.titulo.toLowerCase().includes(query)
        const descMatch = (task.descripcion || '').toLowerCase().includes(query)
        const projectName = projectMap.get(task.projectId) || ''
        const projectMatch = projectName.toLowerCase().includes(query)
        const assigneeMatch = task.asignadoA.some(id => {
          const u = userMap.get(id)
          if (!u) return false
          const name = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase()
          return name.includes(query) || u.email.toLowerCase().includes(query)
        })

        if (!titleMatch && !descMatch && !projectMatch && !assigneeMatch) return false
      }

      return true
    }).sort((a, b) => {
      // Priority ordering: en_progreso first, then pendiente, then completado
      const orderScore = { en_progreso: 0, pendiente: 1, completado: 2 }
      if (orderScore[a.estado] !== orderScore[b.estado]) {
        return orderScore[a.estado] - orderScore[b.estado]
      }
      // Secondary: newest updated or created
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return timeB - timeA
    })
  }, [tasks, statusFilter, teamFilter, searchQuery, projectMap, userMap])

  const getSubTeamBadge = (teamKey?: TeamType) => {
    if (!teamKey || !SUBTEAM_CONFIG[teamKey]) {
      return (
        <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-xs">
          General / Interdisciplinario
        </Badge>
      )
    }
    const cfg = SUBTEAM_CONFIG[teamKey]
    return (
      <Badge className={`${cfg.bg} ${cfg.text} ${cfg.border} border text-xs font-semibold flex items-center gap-1.5`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {cfg.label}
      </Badge>
    )
  }

  const getStatusBadge = (estado: Task['estado']) => {
    switch (estado) {
      case 'en_progreso':
        return (
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 border text-xs font-medium flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
            </span>
            En Curso
          </Badge>
        )
      case 'pendiente':
        return (
          <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 border text-xs font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-orange-400" />
            Pendiente
          </Badge>
        )
      case 'completado':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 border text-xs font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Pasada / Completada
          </Badge>
        )
    }
  }

  const getPriorityBadge = (prioridad: Task['prioridad']) => {
    switch (prioridad) {
      case 'alta':
        return <span className="text-[11px] font-semibold text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" /> Alta</span>
      case 'media':
        return <span className="text-[11px] font-medium text-orange-400">Media</span>
      case 'baja':
        return <span className="text-[11px] font-medium text-slate-400">Baja</span>
    }
  }

  return (
    <Card className="bg-space-700/50 border-space-600 shadow-xl overflow-hidden">
      <CardHeader className="border-b border-space-600/60 bg-space-800/40 pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white text-lg sm:text-xl flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Activity className="w-5 h-5" />
              </div>
              Centro de Tracking de Actividades
            </CardTitle>
            <CardDescription className="mt-1 text-slate-300 text-xs sm:text-sm">
              Visibilidad continua y contextualizada de actividades en curso, pendientes y pasadas por sub-equipo.
            </CardDescription>
          </div>

          <Link
            to="/tasks"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors self-start md:self-auto"
          >
            <span>Gestión completa</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Filters Bar */}
        <div className="mt-4 flex flex-col gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-cyan-500 text-space-900 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-space-800/80 text-slate-300 hover:bg-space-600 hover:text-white border border-space-600'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Todas
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-space-900/30 text-[10px]">{counts.total}</span>
            </button>

            <button
              onClick={() => setStatusFilter('en_progreso')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                statusFilter === 'en_progreso'
                  ? 'bg-cyan-500 text-space-900 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-space-800/80 text-cyan-400 hover:bg-space-600 border border-cyan-500/30'
              }`}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              En Curso
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">{counts.en_progreso}</span>
            </button>

            <button
              onClick={() => setStatusFilter('pendiente')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                statusFilter === 'pendiente'
                  ? 'bg-orange-500 text-space-900 font-bold shadow-md shadow-orange-500/20'
                  : 'bg-space-800/80 text-orange-300 hover:bg-space-600 border border-orange-500/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Pendientes
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300 text-[10px]">{counts.pendiente}</span>
            </button>

            <button
              onClick={() => setStatusFilter('completado')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                statusFilter === 'completado'
                  ? 'bg-emerald-500 text-space-900 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-space-800/80 text-emerald-300 hover:bg-space-600 border border-emerald-500/30'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Pasadas / Completadas
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">{counts.completado}</span>
            </button>
          </div>

          {/* Sub-team filter pills & search input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3 text-cyan-400" /> Sub-equipo:
              </span>
              <button
                onClick={() => setTeamFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  teamFilter === 'all'
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40 font-semibold'
                    : 'bg-space-800 text-slate-400 hover:text-white border border-space-600'
                }`}
              >
                Todos
              </button>
              {(['tecnico', 'manager', 'relaciones_publicas'] as TeamType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTeamFilter(t)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    teamFilter === t
                      ? `${SUBTEAM_CONFIG[t].bg} ${SUBTEAM_CONFIG[t].text} ${SUBTEAM_CONFIG[t].border} border font-semibold`
                      : 'bg-space-800 text-slate-400 hover:text-white border border-space-600'
                  }`}
                >
                  {TEAM_LABELS[t]}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrar por actividad o miembro..."
                className="w-full pl-8 pr-3 py-1 rounded-lg bg-space-800 border border-space-600 text-xs text-white placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Sparkles className="w-10 h-10 text-slate-500 mb-3 animate-pulse" />
            <p className="text-sm font-semibold text-slate-300">No se encontraron actividades con los filtros seleccionados</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Intenta cambiar los filtros de estado o sub-equipo para explorar otras iniciativas del proyecto.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTasks.map(task => {
              const projectName = projectMap.get(task.projectId)
              const latestUpdate = task.progressUpdates && task.progressUpdates.length > 0
                ? task.progressUpdates[task.progressUpdates.length - 1]
                : null
              const latestAuthor = latestUpdate ? userMap.get(latestUpdate.authorId) : null

              return (
                <div
                  key={task.id}
                  className="group relative rounded-xl border border-space-600/80 bg-space-800/60 p-4 transition-all duration-200 hover:border-cyan-500/40 hover:bg-space-800/90 shadow-sm"
                >
                  {/* Top Bar: Sub-team & Status Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {getSubTeamBadge(task.equipo)}
                      {getStatusBadge(task.estado)}
                      {getPriorityBadge(task.prioridad)}
                    </div>

                    {projectName && (
                      <span className="text-xs text-cyan-400 font-medium flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                        <FolderKanban className="w-3 h-3" />
                        {projectName}
                      </span>
                    )}
                  </div>

                  {/* Activity Title & Description */}
                  <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors leading-snug">
                    {task.titulo}
                  </h3>
                  {task.descripcion && (
                    <p className="mt-1.5 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {task.descripcion}
                    </p>
                  )}

                  {/* Latest Progress Update Callout (Contextual Info) */}
                  {latestUpdate && (
                    <div className="mt-3 rounded-lg border border-space-600/60 bg-space-900/50 p-2.5 text-xs">
                      <div className="flex items-center gap-1.5 text-cyan-300 font-semibold mb-1">
                        <MessageSquareText className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Último avance registrado:</span>
                        {latestAuthor && (
                          <span className="text-slate-400 font-normal ml-auto text-[11px]">
                            por {latestAuthor.nombre || extractNameFromEmail(latestAuthor.email)}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 italic text-[11px] leading-relaxed">
                        "{latestUpdate.message}"
                      </p>
                    </div>
                  )}

                  {/* Deliverables & Milestones status */}
                  {((task.deliverables && task.deliverables.length > 0) || (task.hitos && task.hitos.length > 0)) && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {task.deliverables && task.deliverables.length > 0 && (
                        <span className="bg-space-700 px-2 py-0.5 rounded text-[11px]">
                          📦 Entregables: <strong className="text-white">{task.deliverables.filter(d => d.estado === 'aprobado').length}/{task.deliverables.length}</strong>
                        </span>
                      )}
                      {task.hitos && task.hitos.length > 0 && (
                        <span className="bg-space-700 px-2 py-0.5 rounded text-[11px]">
                          🎯 Hitos: <strong className="text-white">{task.hitos.filter(h => h.estado === 'completado').length}/{task.hitos.length}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer: Assigned Members & Timeline */}
                  <div className="mt-3 pt-3 border-t border-space-600/40 flex flex-wrap items-center justify-between gap-3">
                    {/* Assigned Members */}
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px] text-slate-400 mr-1">Involucrados:</span>
                      {task.asignadoA.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic">Sin asignar</span>
                      ) : (
                        <div className="flex items-center -space-x-1.5">
                          {task.asignadoA.map(id => {
                            const assignee = userMap.get(id)
                            if (!assignee) return null
                            const displayName = assignee.nombre ? `${assignee.nombre} ${assignee.apellido || ''}`.trim() : extractNameFromEmail(assignee.email)
                            const initials = displayName.charAt(0).toUpperCase()

                            return (
                              <div
                                key={id}
                                title={displayName}
                                className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 text-[10px] font-bold text-white ring-2 ring-space-800"
                              >
                                {assignee.photoURL ? (
                                  <img
                                    src={assignee.photoURL}
                                    alt={displayName}
                                    className="h-full w-full rounded-full object-cover"
                                  />
                                ) : (
                                  initials
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Timeline dates */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      {task.fechaLimite && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Calendar className="w-3 h-3 text-cyan-400" />
                          Límite: <strong className="text-white">{new Date(task.fechaLimite).toLocaleDateString('es-CL')}</strong>
                        </span>
                      )}

                      {task.completedAt && (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Concluida: {new Date(task.completedAt).toLocaleDateString('es-CL')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
