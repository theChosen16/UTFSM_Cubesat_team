import { collection, query, where, getDocs, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { Notification as NotificationType } from '@/types'
import { logger } from '@/lib/logger'

export class NotificationService {
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
      const ref = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        recipientId: payload.recipientId,
        type: 'message',
        title: 'Nuevo Mensaje',
        message: payload.message,
        read: false,
        createdAt: Timestamp.now(),
        senderId: payload.senderId,
        senderName: payload.senderName,
      })
      return ref.id
    } catch (error) {
      logger.error('Error in NotificationService.sendMessage', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }
}
