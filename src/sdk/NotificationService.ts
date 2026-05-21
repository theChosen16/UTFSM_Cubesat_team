import { collection, query, where, getDocs, doc, updateDoc, addDoc, Timestamp, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { Notification as NotificationType, Task } from '@/types'
import { logger } from '@/lib/logger'

interface CreateNotificationPayload {
  recipientId: string
  type: NotificationType['type']
  title: string
  message: string
  senderId: string
  senderName?: string
  relatedId?: string
  dedupe?: boolean
}

export class NotificationService {
  private static async notificationExists(payload: Pick<CreateNotificationPayload, 'recipientId' | 'type' | 'relatedId'>): Promise<boolean> {
    if (!payload.relatedId) return false

    const existingQuery = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('recipientId', '==', payload.recipientId),
      where('type', '==', payload.type),
      where('relatedId', '==', payload.relatedId),
      limit(1)
    )

    const snapshot = await getDocs(existingQuery)
    return !snapshot.empty
  }

  static async create(payload: CreateNotificationPayload): Promise<string | null> {
    try {
      if (payload.dedupe) {
        const alreadyExists = await this.notificationExists(payload)
        if (alreadyExists) return null
      }

      const ref = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        recipientId: payload.recipientId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        read: false,
        createdAt: Timestamp.now(),
        senderId: payload.senderId,
        senderName: payload.senderName,
        relatedId: payload.relatedId,
      })

      return ref.id
    } catch (error) {
      logger.error('Error in NotificationService.create', { error: error instanceof Error ? error : undefined, payload })
      throw error
    }
  }

  /**
   * Obtiene todas las notificaciones de un usuario
   */
  static async getByUser(userId: string): Promise<NotificationType[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('recipientId', '==', userId)
      )
      const snapshot = await getDocs(q)
      
      const notifications = snapshot.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          recipientId: data.recipientId || '',
          type: data.type || 'system',
          title: data.title || '',
          message: data.message || '',
          read: data.read || false,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          senderId: data.senderId || undefined,
          senderName: data.senderName || undefined,
          relatedId: data.relatedId || undefined,
        } as NotificationType
      })
      
      // Ordenar: no leídas primero, luego por fecha descendente
      notifications.sort((a, b) => {
        if (!a.read && b.read) return -1
        if (a.read && !b.read) return 1
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      
      return notifications
    } catch (error) {
      logger.error('Error in NotificationService.getByUser', { error: error instanceof Error ? error : undefined, userId })
      throw error
    }
  }

  /**
   * Se suscribe a las notificaciones de un usuario en tiempo real
   */
  static subscribeByUser(
    userId: string,
    onNext: (notifications: NotificationType[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('recipientId', '==', userId)
      )

      return onSnapshot(
        q,
        (snapshot) => {
          const notifications = snapshot.docs.map(d => {
            const data = d.data()
            return {
              id: d.id,
              recipientId: data.recipientId || '',
              type: data.type || 'system',
              title: data.title || '',
              message: data.message || '',
              read: data.read || false,
              createdAt: data.createdAt?.toDate?.() || new Date(),
              senderId: data.senderId || undefined,
              senderName: data.senderName || undefined,
              relatedId: data.relatedId || undefined,
            } as NotificationType
          })

          // Ordenar: no leídas primero, luego por fecha descendente
          notifications.sort((a, b) => {
            if (!a.read && b.read) return -1
            if (a.read && !b.read) return 1
            return b.createdAt.getTime() - a.createdAt.getTime()
          })

          onNext(notifications)
        },
        (error) => {
          logger.error('Error in NotificationService.subscribeByUser', { error: error instanceof Error ? error : undefined, userId })
          if (onError) onError(error)
        }
      )
    } catch (error) {
      logger.error('Error starting subscription in NotificationService.subscribeByUser', { error: error instanceof Error ? error : undefined, userId })
      throw error
    }
  }

  /**
   * Marca una notificación como leída
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), { read: true })
    } catch (error) {
      logger.error('Error in NotificationService.markAsRead', { error: error instanceof Error ? error : undefined, notificationId })
      throw error
    }
  }

  /**
   * Envía un mensaje directo a otro usuario
   */
  static async sendMessage(payload: {
    recipientId: string
    message: string
    senderId: string
    senderName: string
  }): Promise<string> {
    try {
      const ref = await this.create({
        recipientId: payload.recipientId,
        type: 'message',
        title: 'Nuevo Mensaje',
        message: payload.message,
        senderId: payload.senderId,
        senderName: payload.senderName,
      })
      return ref || ''
    } catch (error) {
      logger.error('Error in NotificationService.sendMessage', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async ensureDeadlineReminder(task: Task, senderId: string, senderName?: string): Promise<void> {
    try {
      if (!task.fechaLimite || task.estado === 'completado' || task.asignadoA.length === 0) {
        return
      }

      const deadline = new Date(task.fechaLimite)
      if (Number.isNaN(deadline.getTime())) return

      const now = Date.now()
      const diffMs = deadline.getTime() - now
      const threeDaysMs = 1000 * 60 * 60 * 24 * 3

      if (diffMs > threeDaysMs) return

      const relatedId = `${task.id}:${task.fechaLimite}`
      const title = diffMs < 0 ? 'Plazo vencido de tarea' : 'Plazo próximo de tarea'
      const message = diffMs < 0
        ? `La tarea "${task.titulo}" ya superó su plazo comprometido.`
        : `La tarea "${task.titulo}" vence pronto. Revisa sus entregables y avances.`

      await Promise.all(
        [...new Set(task.asignadoA.filter(Boolean))].map(recipientId => this.create({
          recipientId,
          type: 'deadline_reminder',
          title,
          message,
          senderId,
          senderName,
          relatedId,
          dedupe: true,
        }))
      )
    } catch (error) {
      logger.error('Error in NotificationService.ensureDeadlineReminder', { error: error instanceof Error ? error : undefined, taskId: task.id })
    }
  }

  static async notifyDeliverableUploaded(payload: {
    task: Task
    deliverableTitle: string
    uploadedBy: string
    senderName?: string
    fileName: string
  }): Promise<void> {
    try {
      const recipients = [...new Set([payload.task.creadoPor, ...payload.task.asignadoA])]
        .filter(recipientId => recipientId && recipientId !== payload.uploadedBy)

      if (recipients.length === 0) return

      await Promise.all(recipients.map(recipientId => this.create({
        recipientId,
        type: 'deliverable_uploaded',
        title: 'Nuevo entregable subido',
        message: `Se subió "${payload.fileName}" para el entregable "${payload.deliverableTitle}" de la tarea "${payload.task.titulo}".`,
        senderId: payload.uploadedBy,
        senderName: payload.senderName,
        relatedId: `${payload.task.id}:${payload.fileName}:${Date.now()}`,
      })))
    } catch (error) {
      logger.error('Error in NotificationService.notifyDeliverableUploaded', { error: error instanceof Error ? error : undefined, taskId: payload.task.id })
    }
  }
}
