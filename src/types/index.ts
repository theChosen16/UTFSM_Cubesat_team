export type UserRole = 'maestro' | 'admin' | 'manager' | 'tecnico' | 'relaciones_publicas'

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
  asignadoA: string
  prioridad: 'alta' | 'media' | 'baja'
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
