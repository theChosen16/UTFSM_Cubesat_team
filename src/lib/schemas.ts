import { z } from 'zod'
import { TEAM_TYPES } from '@/lib/ui-constants' // Necesitamos un array literal, o podemos usar el type nativo con Zod
// Si TEAM_TYPES no está exportado, declaramos la tupla a nivel Zod:
const validTeams = ['tecnico', 'manager', 'relaciones_publicas'] as const

/**
 * Validaciones para Creación de Proyecto
 */
export const projectFormSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(80, "Nombre demasiado largo"),
  descripcion: z.string().optional(),
  estado: z.enum(['planificacion', 'en_progreso', 'completado']),
  fechaLimite: z.string().optional(),
})
export type ProjectFormData = z.infer<typeof projectFormSchema>

/**
 * Validaciones para Creación/Edición de Tareas
 */
export const taskFormSchema = z.object({
  titulo: z.string().min(3, "El título debe tener al menos 3 caracteres").max(100, "El título es demasiado largo"),
  descripcion: z.string().optional(),
  projectId: z.string().optional(),
  equipo: z.enum(validTeams, { errorMap: () => ({ message: 'Equipo inválido' }) }),
  asignadoA: z.array(z.string()),
  prioridad: z.enum(['alta', 'media', 'baja']),
  puntajeImportancia: z.number().min(1, "El puntaje mínimo es 1").max(10, "El puntaje máximo es 10").optional(),
})
export type TaskFormData = z.infer<typeof taskFormSchema>

/**
 * Validaciones de Perfil/Registro
 */
export const userRegistrationSchema = z.object({
  email: z.string().email("Correo inválido").regex(/.*@.*\.usm\.cl$/, "Debe ser un correo institucional USM"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})
export type UserRegistrationData = z.infer<typeof userRegistrationSchema>
