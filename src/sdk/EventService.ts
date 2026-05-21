import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { CalendarEvent, CalendarEventType } from '@/types'
import { logger } from '@/lib/logger'

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return new Date()
}

const mapEvent = (id: string, data: Record<string, unknown>): CalendarEvent => {
  return {
    id,
    titulo: typeof data.titulo === 'string' ? data.titulo : '',
    descripcion: typeof data.descripcion === 'string' ? data.descripcion : '',
    fechaInicio: typeof data.fechaInicio === 'string' ? data.fechaInicio : new Date().toISOString(),
    fechaFin: typeof data.fechaFin === 'string' ? data.fechaFin : undefined,
    todoElDia: typeof data.todoElDia === 'boolean' ? data.todoElDia : false,
    tipo: (data.tipo as CalendarEventType) || 'otro',
    creadoPor: typeof data.creadoPor === 'string' ? data.creadoPor : '',
    createdAt: toDate(data.createdAt),
    relatedTaskId: typeof data.relatedTaskId === 'string' ? data.relatedTaskId : undefined,
    relatedProjectId: typeof data.relatedProjectId === 'string' ? data.relatedProjectId : undefined,
  }
}

export class EventService {
  static async getAll(): Promise<CalendarEvent[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.EVENTS))
      return snap.docs.map(d => mapEvent(d.id, d.data() as Record<string, unknown>))
    } catch (error) {
      logger.error('Error in EventService.getAll', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async create(data: Omit<CalendarEvent, 'id' | 'createdAt'>): Promise<string> {
    try {
      const payload = {
        ...data,
        createdAt: Timestamp.now()
      }
      const ref = await addDoc(collection(db, COLLECTIONS.EVENTS), payload)
      return ref.id
    } catch (error) {
      logger.error('Error in EventService.create', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async update(id: string, data: Partial<CalendarEvent>): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.EVENTS, id), data)
    } catch (error) {
      logger.error('Error in EventService.update', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.EVENTS, id))
    } catch (error) {
      logger.error('Error in EventService.delete', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  static subscribeAll(
    onNext: (events: CalendarEvent[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const q = query(collection(db, COLLECTIONS.EVENTS))
      return onSnapshot(
        q,
        (snapshot) => {
          const events = snapshot.docs.map(d => mapEvent(d.id, d.data() as Record<string, unknown>))
          onNext(events)
        },
        (error) => {
          logger.error('Error in EventService.subscribeAll', { error: error instanceof Error ? error : undefined })
          if (onError) onError(error)
        }
      )
    } catch (error) {
      logger.error('Error starting subscription in EventService.subscribeAll', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }
}
