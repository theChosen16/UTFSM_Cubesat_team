import { UserRole, TeamType, NotificationType } from '@/types'

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

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  task_assigned: 'Tarea Asignada',
  message: 'Mensaje',
  system: 'Sistema',
}
