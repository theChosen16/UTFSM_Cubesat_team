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

export const sanitizeTeamType = (value: unknown): TeamType | undefined => {
  return isTeamType(value) ? value : undefined
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
  equipo?: TeamType
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
