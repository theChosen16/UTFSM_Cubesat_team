export type UserRole = 'maestro' | 'admin'

export type TeamType = 'tecnico' | 'manager' | 'relaciones_publicas'

export type Genero = 'masculino' | 'femenino' | 'otro'

const USER_ROLES: readonly UserRole[] = ['maestro', 'admin'] as const
const TEAM_TYPES: readonly TeamType[] = ['tecnico', 'manager', 'relaciones_publicas'] as const
const GENEROS: readonly Genero[] = ['masculino', 'femenino', 'otro'] as const

export const isUserRole = (value: unknown): value is UserRole => {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole)
}

export const isTeamType = (value: unknown): value is TeamType => {
  return typeof value === 'string' && TEAM_TYPES.includes(value as TeamType)
}

export const isGenero = (value: unknown): value is Genero => {
  return typeof value === 'string' && GENEROS.includes(value as Genero)
}

export const sanitizeUserRole = (value: unknown): UserRole | undefined => {
  return isUserRole(value) ? value : undefined
}

/**
 * Sanitize a teams array from Firestore. Handles:
 * - Legacy single `equipo` string field (backward compat)
 * - New `equipos` array field
 * Returns an array with at most 2 unique valid teams.
 */
export const sanitizeUserTeams = (teams: unknown, legacyEquipo?: unknown): TeamType[] => {
  const result: TeamType[] = []
  if (Array.isArray(teams)) {
    for (const t of teams) {
      if (isTeamType(t) && !result.includes(t)) {
        result.push(t)
      }
      if (result.length >= 2) break
    }
  }
  if (result.length === 0 && legacyEquipo !== undefined) {
    const sanitized = sanitizeTeamType(legacyEquipo)
    if (sanitized) result.push(sanitized)
  }
  return result
}

/** Check if a user has a specific role (single role model) */
export const hasRole = (user: { rol?: UserRole } | null | undefined, role: UserRole): boolean => {
  return user?.rol === role
}

/** Check if a user has any of the specified roles */
export const hasAnyRole = (user: { rol?: UserRole } | null | undefined, ...roles: UserRole[]): boolean => {
  return user?.rol !== undefined && roles.includes(user.rol)
}

export const sanitizeTeamType = (value: unknown): TeamType | undefined => {
  return isTeamType(value) ? value : undefined
}

/** Check if a user belongs to a specific team */
export const hasTeam = (user: { equipos?: TeamType[] } | null | undefined, team: TeamType): boolean => {
  return user?.equipos?.includes(team) ?? false
}

/** Check if a user belongs to any of the specified teams */
export const hasAnyTeam = (user: { equipos?: TeamType[] } | null | undefined, ...teams: TeamType[]): boolean => {
  return teams.some(t => hasTeam(user, t))
}

export const sanitizeGenero = (value: unknown): Genero | undefined => {
  return isGenero(value) ? value : undefined
}

export interface Questionnaire {
  intereses: string
  habilidades: string
  motivacion: string
  disponibilidad: string
  proyectosPrevios: string
}

export interface User {
  id: string
  email: string
  nombre: string
  apellido: string
  rol?: UserRole
  equipos?: TeamType[]
  genero?: Genero
  photoURL?: string
  createdAt: Date
  isActive: boolean
  career?: string
  year?: string
  questionnaire?: Questionnaire
}

export interface Project {
  id: string
  nombre: string
  descripcion: string
  estado: 'planificacion' | 'en_progreso' | 'completado'
  creadoPor: string
  asignadoA: string[]
  fechaLimite?: Date
  createdAt: Date
}

export type TaskStatus = 'pendiente' | 'en_progreso' | 'completado'

export type TaskPriority = 'alta' | 'media' | 'baja'

export type DeliverableStatus = 'pendiente' | 'entregado' | 'aprobado'

export interface TaskMilestone {
  id: string
  titulo: string
  descripcion?: string
  estado: 'pendiente' | 'completado'
  fechaLimite?: string
  completedAt?: string
}

export interface TaskDeliverable {
  id: string
  titulo: string
  descripcion?: string
  estado: DeliverableStatus
  fechaLimite?: string
  attachmentIds?: string[]
  deliveredAt?: string
  deliveredBy?: string
}

export interface TaskProgressUpdate {
  id: string
  authorId: string
  message: string
  createdAt: string
  status?: TaskStatus
}

export interface Task {
  id: string
  projectId: string
  titulo: string
  descripcion: string
  estado: TaskStatus
  asignadoA: string[]
  equipo: TeamType
  prioridad: TaskPriority
  creadoPor: string
  puntajeImportancia?: number
  fechaLimite?: string
  hitos?: TaskMilestone[]
  deliverables?: TaskDeliverable[]
  progressUpdates?: TaskProgressUpdate[]
  attachmentIds?: string[]
  fechaInicioReal?: string  // ISO date string
  fechaFinReal?: string     // ISO date string
  tiempoInvertido?: string  // Human readable string like '4 días'
  completedBy?: string
  completedAt?: string
  scoreAwarded?: number
  createdAt: Date
}

export type ActivityLogType =
  | 'task_created'
  | 'task_status_changed'
  | 'task_progress_logged'
  | 'task_completed'
  | 'deliverable_uploaded'
  | 'deliverable_status_changed'

export interface ActivityLogEntry {
  id: string
  userId: string
  type: ActivityLogType
  relatedId: string
  taskId?: string
  projectId?: string
  deliverableId?: string
  description: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface FileRecord {
  id: string
  name: string
  storagePath: string
  downloadURL: string
  mimeType: string
  size: number
  uploadedBy: string
  createdAt: Date
  taskId?: string
  projectId?: string
  deliverableId?: string
}

export interface MemberScore {
  userId: string
  totalCompletedTasks: number
  totalScore: number
  lastActivityAt?: Date
}

export type NotificationType =
  | 'task_assigned'
  | 'deliverable_uploaded'
  | 'deadline_reminder'
  | 'message'
  | 'system'

export interface Notification {
  id: string
  recipientId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: Date
  senderId?: string
  senderName?: string
  relatedId?: string
}
