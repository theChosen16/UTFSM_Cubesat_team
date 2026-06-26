import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { User, UserRole, TeamType, sanitizeUserRole, sanitizeUserTeams, sanitizeGenero } from '@/types'
import { logger } from '@/lib/logger'
import { extractFullNameFromEmail } from '@/lib/utils'

export class UserService {
  static async getAll(): Promise<User[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.USERS))
      return snap.docs.map(doc => {
        const data = doc.data()
        return this.mapFirestoreToUser(doc.id, data, {
          id: doc.id,
          email: '',
          nombre: '',
          apellido: '',
          createdAt: new Date(),
          isActive: true
        })
      })
    } catch (error) {
      logger.error('Error in UserService.getAll', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async getById(id: string, fallback: User): Promise<User> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, id))
      if (!snap.exists()) return fallback
      return this.mapFirestoreToUser(id, snap.data(), fallback)
    } catch (error) {
      logger.error('Error in UserService.getById', { error: error instanceof Error ? error : undefined, id })
      return fallback
    }
  }

  static async updateProfile(id: string, data: Partial<User>): Promise<void> {
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, id), data, { merge: true })
    } catch (error) {
      logger.error('Error in UserService.updateProfile', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  static async updateRole(id: string, newRole: UserRole | undefined): Promise<void> {
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, id), { rol: newRole || null }, { merge: true })
    } catch (error) {
      logger.error('Error in UserService.updateRole', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  static async updateTeams(id: string, newTeams: TeamType[]): Promise<void> {
    try {
      const limitedTeams = newTeams.slice(0, 2)
      await setDoc(doc(db, COLLECTIONS.USERS, id), { equipos: limitedTeams }, { merge: true })
    } catch (error) {
      logger.error('Error in UserService.updateTeams', { error: error instanceof Error ? error : undefined, id })
      throw error
    }
  }

  // --- Helpers ---
  private static mapFirestoreToUser(id: string, rawData: Record<string, unknown>, fallbackUser: User): User {
    const email = typeof rawData.email === 'string' ? rawData.email : fallbackUser.email
    let nombre = typeof rawData.nombre === 'string' ? rawData.nombre : fallbackUser.nombre
    let apellido = typeof rawData.apellido === 'string' ? rawData.apellido : fallbackUser.apellido

    if (!nombre && email) {
      const extracted = extractFullNameFromEmail(email)
      nombre = extracted.nombre
      if (!apellido) {
        apellido = extracted.apellido
      }
    }

    const isFirestoreTimestamp = (value: unknown): value is { toDate: () => Date } => {
      return Boolean(value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function')
    }

    const sanitizeQuestionnaire = (value: unknown): User['questionnaire'] => {
      if (!value || typeof value !== 'object') return undefined
      const raw = value as Record<string, unknown>
      return {
        intereses: typeof raw.intereses === 'string' ? raw.intereses : '',
        habilidades: typeof raw.habilidades === 'string' ? raw.habilidades : '',
        motivacion: typeof raw.motivacion === 'string' ? raw.motivacion : '',
        disponibilidad: typeof raw.disponibilidad === 'string' ? raw.disponibilidad : '',
        proyectosPrevios: typeof raw.proyectosPrevios === 'string' ? raw.proyectosPrevios : '',
      }
    }

    const sanitizeSocialLinks = (value: unknown): User['socialLinks'] => {
      if (!value || typeof value !== 'object') return undefined
      const raw = value as Record<string, unknown>
      return {
        linkedin: typeof raw.linkedin === 'string' ? raw.linkedin : undefined,
        github: typeof raw.github === 'string' ? raw.github : undefined,
        website: typeof raw.website === 'string' ? raw.website : undefined,
      }
    }

    return {
      id,
      email,
      nombre,
      apellido,
      rol: sanitizeUserRole(rawData.rol ?? (Array.isArray(rawData.roles) ? rawData.roles[0] : undefined)),
      equipos: sanitizeUserTeams(rawData.equipos, rawData.equipo),
      genero: sanitizeGenero(rawData.genero),
      photoURL: typeof rawData.photoURL === 'string' ? rawData.photoURL : undefined,
      createdAt: isFirestoreTimestamp(rawData.createdAt) ? rawData.createdAt.toDate() : fallbackUser.createdAt,
      isActive: typeof rawData.isActive === 'boolean' ? rawData.isActive : true,
      career: typeof rawData.career === 'string' ? rawData.career : undefined,
      year: typeof rawData.year === 'string' ? rawData.year : undefined,
      questionnaire: sanitizeQuestionnaire(rawData.questionnaire),
      fechaCumpleanos: typeof rawData.fechaCumpleanos === 'string' ? rawData.fechaCumpleanos : undefined,
      confirmadoCubeDesign: typeof rawData.confirmadoCubeDesign === 'boolean' ? rawData.confirmadoCubeDesign : undefined,
      bio: typeof rawData.bio === 'string' ? rawData.bio : undefined,
      title: typeof rawData.title === 'string' ? rawData.title : undefined,
      socialLinks: sanitizeSocialLinks(rawData.socialLinks),
      portfolioImages: Array.isArray(rawData.portfolioImages) ? rawData.portfolioImages.filter(img => typeof img === 'string') : undefined,
      hasSeenOnboarding: typeof rawData.hasSeenOnboarding === 'boolean' ? rawData.hasSeenOnboarding : undefined,
    }
  }
}
