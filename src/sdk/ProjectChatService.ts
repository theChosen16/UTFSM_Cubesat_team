import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ProjectMessage } from '@/types'
import { logger } from '@/lib/logger'

export class ProjectChatService {
  /**
   * Subscribe to messages for a specific project.
   * Useful for real-time chat.
   */
  static subscribeToMessages(projectId: string, callback: (messages: ProjectMessage[]) => void) {
    const q = query(
      collection(db, 'project_messages'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'asc')
    )

    return onSnapshot(q, (snap) => {
      const messages = snap.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          projectId: data.projectId,
          senderId: data.senderId,
          content: data.content || '',
          fileUrls: data.fileUrls || [],
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.(),
          isEdited: data.isEdited || false,
          isAiOrchestrated: data.isAiOrchestrated || false
        } as ProjectMessage
      })
      callback(messages)
    }, (error) => {
      logger.error('Error in ProjectChatService.subscribeToMessages', { error })
    })
  }

  static async sendMessage(data: Omit<ProjectMessage, 'id' | 'createdAt' | 'updatedAt' | 'isEdited'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'project_messages'), {
        ...data,
        createdAt: serverTimestamp(),
        isEdited: false
      })
      return docRef.id
    } catch (error) {
      logger.error('Error sending project message', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async updateMessage(messageId: string, content: string): Promise<void> {
    try {
      const msgRef = doc(db, 'project_messages', messageId)
      await updateDoc(msgRef, {
        content,
        updatedAt: serverTimestamp(),
        isEdited: true
      })
    } catch (error) {
      logger.error('Error updating project message', { error: error instanceof Error ? error : undefined, messageId })
      throw error
    }
  }

  static async deleteMessage(messageId: string): Promise<void> {
    try {
      const msgRef = doc(db, 'project_messages', messageId)
      await deleteDoc(msgRef)
    } catch (error) {
      logger.error('Error deleting project message', { error: error instanceof Error ? error : undefined, messageId })
      throw error
    }
  }
}
