import { collection, getDocs, getDoc, doc, addDoc, updateDoc, Timestamp, arrayUnion, deleteField } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { Task, TaskDeliverable, TaskProgressUpdate, TaskStatus } from '@/types'
import { logger } from '@/lib/logger'
import { ActivityLogService } from '@/sdk/ActivityLogService'
import { NotificationService } from '@/sdk/NotificationService'

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return new Date()
}

const mapTask = (id: string, data: Record<string, unknown>): Task => {
  return {
    id,
    projectId: typeof data.projectId === 'string' ? data.projectId : '',
    titulo: typeof data.titulo === 'string' ? data.titulo : '',
    descripcion: typeof data.descripcion === 'string' ? data.descripcion : '',
    estado: (data.estado as TaskStatus) || 'pendiente',
    asignadoA: Array.isArray(data.asignadoA) ? data.asignadoA.filter((value): value is string => typeof value === 'string') : [],
    equipo: data.equipo === 'manager' || data.equipo === 'relaciones_publicas' ? data.equipo : 'tecnico',
    prioridad: data.prioridad === 'alta' || data.prioridad === 'baja' ? data.prioridad : 'media',
    creadoPor: typeof data.creadoPor === 'string' ? data.creadoPor : '',
    puntajeImportancia: typeof data.puntajeImportancia === 'number' ? data.puntajeImportancia : 0,
    fechaLimite: typeof data.fechaLimite === 'string' ? data.fechaLimite : undefined,
    hitos: Array.isArray(data.hitos) ? data.hitos as Task['hitos'] : [],
    deliverables: Array.isArray(data.deliverables) ? data.deliverables as TaskDeliverable[] : [],
    progressUpdates: Array.isArray(data.progressUpdates) ? data.progressUpdates as TaskProgressUpdate[] : [],
    attachmentIds: Array.isArray(data.attachmentIds) ? data.attachmentIds.filter((value): value is string => typeof value === 'string') : [],
    fechaInicioReal: typeof data.fechaInicioReal === 'string' ? data.fechaInicioReal : undefined,
    fechaFinReal: typeof data.fechaFinReal === 'string' ? data.fechaFinReal : undefined,
    tiempoInvertido: typeof data.tiempoInvertido === 'string' ? data.tiempoInvertido : undefined,
    completedBy: typeof data.completedBy === 'string' ? data.completedBy : undefined,
    completedAt: typeof data.completedAt === 'string' ? data.completedAt : undefined,
    scoreAwarded: typeof data.scoreAwarded === 'number' ? data.scoreAwarded : undefined,
    createdAt: toDate(data.createdAt),
  }
}

export class TaskService {
  static async getAll(): Promise<Task[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.TASKS))
      return snap.docs.map(d => mapTask(d.id, d.data() as Record<string, unknown>))
    } catch (error) {
      logger.error('Error in TaskService.getAll', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async getById(id: string): Promise<Task | null> {
    try {
      const snapshot = await getDoc(doc(db, COLLECTIONS.TASKS, id))
      if (!snapshot.exists()) return null
      return mapTask(snapshot.id, snapshot.data() as Record<string, unknown>)
    } catch (error) {
      logger.error('Error in TaskService.getById', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  static async create(data: Omit<Task, 'id' | 'createdAt'>): Promise<string> {
    try {
      const payload = {
        ...data,
        hitos: data.hitos || [],
        deliverables: data.deliverables || [],
        progressUpdates: data.progressUpdates || [],
        attachmentIds: data.attachmentIds || [],
        createdAt: Timestamp.now()
      }
      const ref = await addDoc(collection(db, COLLECTIONS.TASKS), payload)
      await ActivityLogService.create({
        userId: data.creadoPor,
        type: 'task_created',
        relatedId: ref.id,
        taskId: ref.id,
        projectId: data.projectId || undefined,
        description: `Creó la tarea "${data.titulo}"`,
        metadata: {
          prioridad: data.prioridad,
          puntajeImportancia: data.puntajeImportancia ?? 0,
        },
      })

      // Notify assignees if deadline is approaching
      if (data.fechaLimite && data.asignadoA.length > 0) {
        const createdTask: Task = { ...data, id: ref.id, createdAt: new Date() }
        await NotificationService.ensureDeadlineReminder(createdTask, data.creadoPor).catch(() => undefined)
      }

      return ref.id
    } catch (error) {
      logger.error('Error in TaskService.create', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async updateStatus(id: string, newStatus: Task['estado'], options?: { actorId?: string; task?: Task }): Promise<void> {
    try {
      const task = options?.task ?? await this.getById(id)
      const payload: Record<string, unknown> = { estado: newStatus }
      if (newStatus === 'completado') {
        payload.completedAt = new Date().toISOString()
        payload.completedBy = options?.actorId || task?.completedBy || ''
        payload.scoreAwarded = task?.puntajeImportancia ?? 0
      } else {
        payload.completedAt = deleteField()
        payload.completedBy = deleteField()
        payload.scoreAwarded = deleteField()
      }
      await updateDoc(doc(db, COLLECTIONS.TASKS, id), payload)

      if (options?.actorId) {
        await ActivityLogService.create({
          userId: options.actorId,
          type: newStatus === 'completado' ? 'task_completed' : 'task_status_changed',
          relatedId: id,
          taskId: id,
          projectId: task?.projectId || undefined,
          description: newStatus === 'completado'
            ? `Marcó la tarea "${task?.titulo || id}" como completada`
            : `Cambió el estado de la tarea "${task?.titulo || id}" a ${newStatus}`,
          metadata: {
            previousStatus: task?.estado || null,
            newStatus,
            scoreAwarded: task?.puntajeImportancia ?? 0,
          },
        })
      }
    } catch (error) {
      logger.error('Error in TaskService.updateStatus', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  static async updateTime(id: string, inicio: string, fin: string, tiempoInvertido: string): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.TASKS, id), {
        fechaInicioReal: inicio,
        fechaFinReal: fin,
        tiempoInvertido: tiempoInvertido
      })
    } catch (error) {
      logger.error('Error in TaskService.updateTime', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  static async addProgressUpdate(taskId: string, payload: {
    authorId: string
    message: string
    status?: TaskStatus
  }): Promise<TaskProgressUpdate> {
    try {
      const progressUpdate: TaskProgressUpdate = {
        id: crypto.randomUUID(),
        authorId: payload.authorId,
        message: payload.message,
        createdAt: new Date().toISOString(),
        status: payload.status,
      }
      await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), {
        progressUpdates: arrayUnion(progressUpdate),
      })

      const task = await this.getById(taskId)
      await ActivityLogService.create({
        userId: payload.authorId,
        type: 'task_progress_logged',
        relatedId: taskId,
        taskId,
        projectId: task?.projectId || undefined,
        description: `Registró un avance en la tarea "${task?.titulo || taskId}"`,
        metadata: {
          message: payload.message,
          status: payload.status || null,
        },
      })

      return progressUpdate
    } catch (error) {
      logger.error('Error in TaskService.addProgressUpdate', { error: error instanceof Error ? error : undefined, taskId })
      throw error
    }
  }

  static async updateDeliverable(taskId: string, deliverableId: string, patch: Partial<TaskDeliverable>, actorId?: string): Promise<TaskDeliverable> {
    try {
      const task = await this.getById(taskId)
      if (!task) {
        throw new Error('Task not found')
      }

      const deliverables = (task.deliverables || []).map(deliverable => {
        if (deliverable.id !== deliverableId) return deliverable
        return { ...deliverable, ...patch }
      })

      const updatedDeliverable = deliverables.find(deliverable => deliverable.id === deliverableId)
      if (!updatedDeliverable) {
        throw new Error('Deliverable not found')
      }

      await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), { deliverables })

      if (actorId) {
        await ActivityLogService.create({
          userId: actorId,
          type: 'deliverable_status_changed',
          relatedId: deliverableId,
          taskId,
          projectId: task.projectId || undefined,
          deliverableId,
          description: `Actualizó el entregable "${updatedDeliverable.titulo}"`,
          metadata: {
            patch,
          },
        })
      }

      return updatedDeliverable
    } catch (error) {
      logger.error('Error in TaskService.updateDeliverable', { error: error instanceof Error ? error : undefined, taskId, deliverableId })
      throw error
    }
  }

  static async attachFileToDeliverable(taskId: string, deliverableId: string, attachmentId: string, actorId: string, meta?: { fileName?: string; actorName?: string }): Promise<void> {
    try {
      const task = await this.getById(taskId)
      if (!task) {
        throw new Error('Task not found')
      }

      const deliverable = task.deliverables?.find(item => item.id === deliverableId)
      if (!deliverable) {
        throw new Error('Deliverable not found')
      }

      const attachmentIds = deliverable.attachmentIds?.includes(attachmentId)
        ? deliverable.attachmentIds
        : [...(deliverable.attachmentIds || []), attachmentId]

      await this.updateDeliverable(taskId, deliverableId, {
        attachmentIds,
        estado: 'entregado',
        deliveredAt: new Date().toISOString(),
        deliveredBy: actorId,
      }, actorId)

      await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), {
        attachmentIds: arrayUnion(attachmentId),
      })

      // Notify task participants about the uploaded deliverable
      const updatedTask = await this.getById(taskId)
      if (updatedTask && deliverable) {
        await NotificationService.notifyDeliverableUploaded({
          task: updatedTask,
          deliverableTitle: deliverable.titulo,
          uploadedBy: actorId,
          senderName: meta?.actorName,
          fileName: meta?.fileName ?? attachmentId,
        }).catch(() => undefined)
      }
    } catch (error) {
      logger.error('Error in TaskService.attachFileToDeliverable', { error: error instanceof Error ? error : undefined, taskId, deliverableId, attachmentId })
      throw error
    }
  }
}
