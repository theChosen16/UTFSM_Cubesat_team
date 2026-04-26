import { z } from 'zod'

const validTeams = ['tecnico', 'manager', 'relaciones_publicas'] as const

const milestoneSchema = z.object({
  id: z.string().min(1, 'El hito requiere un identificador'),
  titulo: z.string().min(1, 'El hito debe tener un título').max(100, 'El título del hito es demasiado largo'),
  descripcion: z.string().optional(),
  estado: z.enum(['pendiente', 'completado']).default('pendiente'),
  fechaLimite: z.string().optional(),
  completedAt: z.string().optional(),
})

const deliverableSchema = z.object({
  id: z.string().min(1, 'El entregable requiere un identificador'),
  titulo: z.string().min(1, 'El entregable debe tener un título').max(100, 'El título del entregable es demasiado largo'),
  descripcion: z.string().optional(),
  estado: z.enum(['pendiente', 'entregado', 'aprobado']).default('pendiente'),
  fechaLimite: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
  deliveredAt: z.string().optional(),
  deliveredBy: z.string().optional(),
})

/**
 * Validaciones para Creación de Proyecto
 */
export const projectFormSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(80, "Nombre demasiado largo"),
  descripcion: z.string().default(''),
  estado: z.enum(['planificacion', 'en_progreso', 'completado']),
  fechaLimite: z.string().optional(),
})
export type ProjectFormData = z.infer<typeof projectFormSchema>

/**
 * Validaciones para Creación/Edición de Tareas
 */
export const taskFormSchema = z.object({
  titulo: z.string().min(3, "El título debe tener al menos 3 caracteres").max(100, "El título es demasiado largo"),
  descripcion: z.string().default(''),
  projectId: z.string().default(''),
  equipo: z.enum(validTeams, { error: 'Equipo inválido' }),
  asignadoA: z.array(z.string()),
  prioridad: z.enum(['alta', 'media', 'baja']),
  puntajeImportancia: z.number().min(1, "El puntaje mínimo es 1").max(10, "El puntaje máximo es 10").optional(),
  fechaLimite: z.string().optional(),
  hitos: z.array(milestoneSchema).default([]),
  deliverables: z.array(deliverableSchema).default([]),
  attachmentIds: z.array(z.string()).default([]),
})
export type TaskFormData = z.infer<typeof taskFormSchema>

/**
 * Validaciones de Perfil/Registro
 */
export const userRegistrationSchema = z.object({
  email: z.string().email("Correo inválido").regex(
    /^[a-zA-Z0-9._%+\-]+@(sansano\.)?usm\.cl$/i,
    "Debe ser un correo institucional USM (@usm.cl o @sansano.usm.cl)"
  ),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})
export type UserRegistrationData = z.infer<typeof userRegistrationSchema>
