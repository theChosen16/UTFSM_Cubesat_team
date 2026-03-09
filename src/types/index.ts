export type UserRole = 'maestro' | 'admin' | 'manager' | 'tecnico' | 'relaciones_publicas'

export type TeamType = 'tecnico' | 'manager' | 'relaciones_publicas'

export type Genero = 'masculino' | 'femenino' | 'otro'

const USER_ROLES: readonly UserRole[] = ['maestro', 'admin', 'manager', 'tecnico', 'relaciones_publicas'] as const
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

export const sanitizeUserRole = (value: unknown, fallback: UserRole = 'tecnico'): UserRole => {
  return isUserRole(value) ? value : fallback
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
  rol: UserRole
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
  manager: 'Manager',
  tecnico: 'Equipo Técnico',
  relaciones_publicas: 'Relaciones Públicas',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  maestro: 'bg-orange-500',
  admin: 'bg-red-500',
  manager: 'bg-cyan-500',
  tecnico: 'bg-purple-500',
  relaciones_publicas: 'bg-green-500',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  maestro: 'Dueño del sistema. Puede asignar administradores y cualquier otro rol.',
  admin: 'Gestiona contenido, proyectos y asigna roles al equipo.',
  manager: 'Crea proyectos, controla el equipo y guía el desarrollo.',
  tecnico: 'Desarrollo de software, hardware, estructura, simulación y cálculos.',
  relaciones_publicas: 'Redes sociales, FabLab, contactos universitarios y trámites.',
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

export interface RoleRequest {
  id: string
  userId: string
  userEmail: string
  userName: string
  rolSolicitado: UserRole
  mensaje: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: string
}
