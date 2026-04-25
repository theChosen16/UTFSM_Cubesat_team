import { addDoc, collection, getDocs, query, Timestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { ActivityLogEntry } from '@/types'
import { logger } from '@/lib/logger'

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return new Date()
}

export class ActivityLogService {
  static async create(entry: Omit<ActivityLogEntry, 'id' | 'createdAt'>): Promise<string> {
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.ACTIVITY_LOG), {
        ...entry,
        createdAt: Timestamp.now(),
      })
      return ref.id
    } catch (error) {
      logger.error('Error in ActivityLogService.create', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async getAll(): Promise<ActivityLogEntry[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.ACTIVITY_LOG))
      return snapshot.docs
        .map(document => ({
          id: document.id,
          ...(document.data() as Omit<ActivityLogEntry, 'id' | 'createdAt'>),
          createdAt: toDate(document.data().createdAt),
        }))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    } catch (error) {
      logger.error('Error in ActivityLogService.getAll', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async getByUser(userId: string): Promise<ActivityLogEntry[]> {
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTIONS.ACTIVITY_LOG), where('userId', '==', userId)))
      return snapshot.docs
        .map(document => ({
          id: document.id,
          ...(document.data() as Omit<ActivityLogEntry, 'id' | 'createdAt'>),
          createdAt: toDate(document.data().createdAt),
        }))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    } catch (error) {
      logger.error('Error in ActivityLogService.getByUser', { error: error instanceof Error ? error : undefined, userId })
      throw error
    }
  }
}