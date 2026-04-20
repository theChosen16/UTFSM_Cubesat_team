import { collection, getDocs, doc, addDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { Task } from '@/types'
import { logger } from '@/lib/logger'

export class TaskService {
  static async getAll(): Promise<Task[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.TASKS))
      return snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          projectId: data.projectId || '',
          titulo: data.titulo || '',
          descripcion: data.descripcion || '',
          estado: data.estado || 'pendiente',
          asignadoA: Array.isArray(data.asignadoA) ? data.asignadoA : (data.asignadoA ? [data.asignadoA] : []),
          equipo: data.equipo || 'tecnico',
          prioridad: data.prioridad || 'media',
          creadoPor: data.creadoPor || '',
          puntajeImportancia: data.puntajeImportancia || 0,
          fechaInicioReal: data.fechaInicioReal,
          fechaFinReal: data.fechaFinReal,
          tiempoInvertido: data.tiempoInvertido,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Task
      })
    } catch (error) {
      logger.error('Error in TaskService.getAll', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async create(data: Omit<Task, 'id' | 'createdAt'>): Promise<string> {
    try {
      const payload = {
        ...data,
        createdAt: Timestamp.now()
      }
      const ref = await addDoc(collection(db, COLLECTIONS.TASKS), payload)
      return ref.id
    } catch (error) {
      logger.error('Error in TaskService.create', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async updateStatus(id: string, newStatus: Task['estado']): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.TASKS, id), { estado: newStatus })
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
}
