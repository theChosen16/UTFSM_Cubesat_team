import { collection, getDocs, doc, getDoc, addDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { Project } from '@/types'
import { logger } from '@/lib/logger'

export class ProjectService {
  static async getAll(): Promise<Project[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.PROJECTS))
      return snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          nombre: data.nombre || data.name || '',
          descripcion: data.descripcion || data.description || '',
          estado: data.estado || data.status || 'planificacion',
          creadoPor: data.creadoPor || '',
          asignadoA: Array.isArray(data.asignadoA) ? data.asignadoA : [],
          fechaLimite: data.fechaLimite || data.deadline,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Project
      })
    } catch (error) {
      logger.error('Error in ProjectService.getAll', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async getById(id: string): Promise<Project | null> {
    try {
      const docRef = doc(db, COLLECTIONS.PROJECTS, id)
      const snap = await getDoc(docRef)
      if (!snap.exists()) return null
      
      const data = snap.data()
      return {
        id: snap.id,
        nombre: data.nombre || data.name || '',
        descripcion: data.descripcion || data.description || '',
        estado: data.estado || data.status || 'planificacion',
        creadoPor: data.creadoPor || '',
        asignadoA: Array.isArray(data.asignadoA) ? data.asignadoA : [],
        fechaLimite: data.fechaLimite || data.deadline,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as Project
    } catch (error) {
      logger.error('Error in ProjectService.getById', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  static async create(data: Omit<Project, 'id' | 'createdAt'>): Promise<string> {
    try {
      const payload = {
        ...data,
        createdAt: Timestamp.now()
      }
      const ref = await addDoc(collection(db, COLLECTIONS.PROJECTS), payload)
      return ref.id
    } catch (error) {
      logger.error('Error in ProjectService.create', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async updateStatus(id: string, newStatus: Project['estado']): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.PROJECTS, id), { estado: newStatus })
    } catch (error) {
      logger.error('Error in ProjectService.updateStatus', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }
}
