import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { doc, getDoc, setDoc, collection, getDocs, query, limit } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { User, UserRole, sanitizeGenero, sanitizeTeamType, sanitizeUserRole, TeamType } from '@/types'
import { logger } from '@/lib/logger'

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, nombre: string, apellido: string) => Promise<void>
  signOut: () => Promise<void>
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>
  updateUserTeam: (userId: string, newTeam: TeamType) => Promise<void>
  updateUserProfile: (data: Partial<User>) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  getAllUsers: () => Promise<User[]>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const sanitizeQuestionnaire = (value: unknown): User['questionnaire'] => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const raw = value as Record<string, unknown>
  return {
    intereses: typeof raw.intereses === 'string' ? raw.intereses : '',
    habilidades: typeof raw.habilidades === 'string' ? raw.habilidades : '',
    motivacion: typeof raw.motivacion === 'string' ? raw.motivacion : '',
    disponibilidad: typeof raw.disponibilidad === 'string' ? raw.disponibilidad : '',
    proyectosPrevios: typeof raw.proyectosPrevios === 'string' ? raw.proyectosPrevios : '',
  }
}

const isFirestoreTimestamp = (value: unknown): value is { toDate: () => Date } => {
  return Boolean(value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function')
}

const sanitizeCreatedAt = (value: unknown, fallback: Date): Date => {
  if (isFirestoreTimestamp(value)) {
    return value.toDate()
  }
  return fallback
}

const mapFirestoreUser = (id: string, rawData: Record<string, unknown>, fallbackUser: User): User => {
  return {
    id,
    email: typeof rawData.email === 'string' ? rawData.email : fallbackUser.email,
    nombre: typeof rawData.nombre === 'string' ? rawData.nombre : fallbackUser.nombre,
    apellido: typeof rawData.apellido === 'string' ? rawData.apellido : fallbackUser.apellido,
    rol: sanitizeUserRole(rawData.rol),
    equipo: sanitizeTeamType(rawData.equipo),
    genero: sanitizeGenero(rawData.genero),
    photoURL: typeof rawData.photoURL === 'string' ? rawData.photoURL : undefined,
    createdAt: sanitizeCreatedAt(rawData.createdAt, fallbackUser.createdAt),
    isActive: typeof rawData.isActive === 'boolean' ? rawData.isActive : true,
    career: typeof rawData.career === 'string' ? rawData.career : undefined,
    year: typeof rawData.year === 'string' ? rawData.year : undefined,
    questionnaire: sanitizeQuestionnaire(rawData.questionnaire),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        const fallbackUser: User = {
          id: fbUser.uid,
          email: fbUser.email || '',
          nombre: fbUser.displayName?.split(' ')[0] || '',
          apellido: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
          rol: undefined,
          createdAt: new Date(),
          isActive: true,
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data() as Record<string, unknown>
            // Auto-repair: if Firestore doc is missing email, backfill from Auth
            const needsRepair = !userData.email && fbUser.email
            if (needsRepair) {
              const repairData: Record<string, string> = { email: fbUser.email! }
              if (!userData.nombre && fbUser.displayName) {
                repairData.nombre = fbUser.displayName.split(' ')[0]
                const rest = fbUser.displayName.split(' ').slice(1).join(' ')
                if (rest) repairData.apellido = rest
              }
              await setDoc(doc(db, 'users', fbUser.uid), repairData, { merge: true })
              Object.assign(userData, repairData)
            }
            setUser(mapFirestoreUser(fbUser.uid, userData, fallbackUser))
          } else {
            setUser(fallbackUser)
          }
        } catch (error) {
          logger.warn('Could not fetch Firestore user data – may be blocked by ad-blocker', { error: error instanceof Error ? error : undefined })
          setUser(fallbackUser)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, nombre: string, apellido: string) => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password)
    
    // Check if this is the first user by looking for any user document
    // If the collection is empty, the first user is 'maestro'
    let isFirstUser = false
    try {
      const usersSnapshot = await getDocs(query(collection(db, 'users'), limit(1)))
      isFirstUser = usersSnapshot.empty
    } catch (error) {
      logger.error('Error checking first user', { error: error instanceof Error ? error : undefined })
      isFirstUser = false 
    }
    
    const userData: Omit<User, 'id'> = {
      email,
      nombre,
      apellido,
      rol: isFirstUser ? 'maestro' : undefined,
      createdAt: new Date(),
      isActive: true,
    }
    
    await setDoc(doc(db, 'users', newUser.uid), userData)
    setUser({ ...userData, id: newUser.uid })
  }

  const updateUserProfile = async (data: Partial<User>) => {
    if (!firebaseUser) return
    await setDoc(doc(db, 'users', firebaseUser.uid), data, { merge: true })
    if (user) {
      setUser({ ...user, ...data })
    }
  }

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null)
    setFirebaseUser(null)
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    await setDoc(doc(db, 'users', userId), { rol: newRole }, { merge: true })
    if (user && user.id === userId) {
      setUser({ ...user, rol: newRole })
    }
  }

  const updateUserTeam = async (userId: string, newTeam: TeamType) => {
    await setDoc(doc(db, 'users', userId), { equipo: newTeam }, { merge: true })
    if (user && user.id === userId) {
      setUser({ ...user, equipo: newTeam })
    }
  }

  const getAllUsers = async (): Promise<User[]> => {
    const usersSnapshot = await getDocs(collection(db, 'users'))
    return usersSnapshot.docs.map(doc => {
      const data = doc.data() as Record<string, unknown>
      const fallbackUser: User = {
        id: doc.id,
        email: '',
        nombre: '',
        apellido: '',
        rol: undefined,
        createdAt: new Date(),
        isActive: true,
      }
      return mapFirestoreUser(doc.id, data, fallbackUser)
    })
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      updateUserRole,
      updateUserTeam,
      updateUserProfile,
      resetPassword,
      getAllUsers
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
