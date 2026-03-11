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

export interface Task {
  id: string
  projectId: string
  titulo: string
  descripcion: string
  estado: 'pendiente' | 'en_progreso' | 'completado'
  asignadoA: string[]
  equipo: TeamType
  prioridad: 'alta' | 'media' | 'baja'
  creadoPor: string
  createdAt: Date
}

export const ROLE_LABELS: Record<UserRole, string> = {
  maestro: 'Usuario Maestro',
  admin: 'Administrador',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  maestro: 'bg-orange-500',
  admin: 'bg-red-500',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  maestro: 'Dueño del sistema. Puede asignar administradores y gestionar todo el equipo.',
  admin: 'Gestiona contenido, proyectos y asigna equipos a los miembros.',
}

export const TEAM_LABELS: Record<TeamType, string> = {
  tecnico: 'Equipo Técnico',
  manager: 'Manager',
  relaciones_publicas: 'Relaciones Públicas',
}

export const TEAM_COLORS: Record<TeamType, string> = {
  tecnico: 'bg-purple-500',
  manager: 'bg-cyan-500',
  relaciones_publicas: 'bg-green-500',
}

export type NotificationType =
  | 'task_assigned'
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

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  task_assigned: 'Tarea Asignada',
  message: 'Mensaje',
  system: 'Sistema',
}
