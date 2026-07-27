import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { User, UserRole, sanitizeGenero, sanitizeUserRole, sanitizeUserTeams, TeamType, hasRole } from '@/types'
import { logger } from '@/lib/logger'
import { COLLECTIONS, VALID_EMAIL_DOMAINS } from '@/lib/constants'
import { extractFullNameFromEmail } from '@/lib/utils'
import { UserService } from '@/sdk/UserService'

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, nombre: string, apellido: string) => Promise<void>
  signOut: () => Promise<void>
  updateUserRole: (userId: string, newRole: UserRole | undefined) => Promise<void>
  updateUserTeams: (userId: string, newTeams: TeamType[]) => Promise<void>
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
  const email = typeof rawData.email === 'string' ? rawData.email : fallbackUser.email
  let nombre = typeof rawData.nombre === 'string' ? rawData.nombre : fallbackUser.nombre
  let apellido = typeof rawData.apellido === 'string' ? rawData.apellido : fallbackUser.apellido

  // Backfill nombre/apellido from email for users who registered before auto-name feature
  if (!nombre && email) {
    const extracted = extractFullNameFromEmail(email)
    nombre = extracted.nombre
    if (!apellido) {
      apellido = extracted.apellido
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
    let isMounted = true
    let authStateVersion = 0

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const currentVersion = ++authStateVersion

      if (!isMounted) {
        return
      }

      setFirebaseUser(fbUser)
      if (fbUser) {
        const extractedName = fbUser.email ? extractFullNameFromEmail(fbUser.email) : { nombre: '', apellido: '' }
        const fallbackUser: User = {
          id: fbUser.uid,
          email: fbUser.email || '',
          nombre: fbUser.displayName?.split(' ')[0] || extractedName.nombre,
          apellido: fbUser.displayName?.split(' ').slice(1).join(' ') || extractedName.apellido,
          createdAt: new Date(),
          isActive: true,
        }

        setUser((currentUser) => (currentUser?.id === fbUser.uid ? { ...fallbackUser, ...currentUser } : fallbackUser))

        try {
          const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, fbUser.uid))
          if (!isMounted || authStateVersion !== currentVersion) {
            return
          }

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
              await setDoc(doc(db, COLLECTIONS.USERS, fbUser.uid), repairData, { merge: true })
              Object.assign(userData, repairData)
            }
            setUser(mapFirestoreUser(fbUser.uid, userData, fallbackUser))
          }
        } catch (error) {
          if (!isMounted || authStateVersion !== currentVersion) {
            return
          }

          logger.warn('Could not fetch Firestore user data – may be blocked by ad-blocker', { error: error instanceof Error ? error : undefined })
          setUser(fallbackUser)
        } finally {
          if (isMounted && authStateVersion === currentVersion) {
            setLoading(false)
          }
        }
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
  }

  const signUp = async (email: string, password: string, nombre: string, apellido: string) => {
    // Enforce the institutional-domain restriction here — not only in the Register form.
    // The Firestore rules are the real security boundary (they now require an @usm.cl /
    // @sansano.usm.cl token to read/write any collection), but blocking a non-institutional
    // account at creation avoids leaving orphaned, unusable Firebase Auth users behind and
    // gives a clear error regardless of which UI path calls signUp.
    const normalizedEmail = email.trim().toLowerCase()
    if (!VALID_EMAIL_DOMAINS.some(domain => normalizedEmail.endsWith(domain))) {
      throw new Error('Debes usar un correo institucional de la USM (@usm.cl o @sansano.usm.cl)')
    }
    const { user: newUser } = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
    
    // Bootstrap: the very first user registered becomes maestro.
    // Uses a secure Firestore transaction and write lock to prevent race conditions.
    // Falls through conservatively (fail-closed) if any error occurs.
    let isFirstUser = false
    try {
      await runTransaction(db, async (transaction) => {
        const lockRef = doc(db, COLLECTIONS.USERS, '_bootstrap_lock')
        const lockDoc = await transaction.get(lockRef)
        if (!lockDoc.exists()) {
          // Note: the lock is readable by any authenticated user (needed so the signup
          // transaction can check it), so we intentionally do NOT store the maestro's
          // email here — only the uid, which the Firestore create rule uses to authorize
          // the one-time maestro bootstrap.
          transaction.set(lockRef, {
            maestroUid: newUser.uid,
            createdAt: new Date()
          })
          isFirstUser = true
        }
      })
      if (isFirstUser) {
        logger.warn('First user bootstrap: granting maestro role', { uid: newUser.uid, email })
      }
    } catch (error) {
      logger.error('Error checking first user — skipping maestro bootstrap', { error: error instanceof Error ? error : undefined })
      isFirstUser = false
    }
    
    const userData: Omit<User, 'id'> = {
      email: normalizedEmail,
      nombre,
      apellido,
      ...(isFirstUser ? { rol: 'maestro' as UserRole } : {}),
      createdAt: new Date(),
      isActive: true,
    }
    
    await setDoc(doc(db, COLLECTIONS.USERS, newUser.uid), userData)
    setUser({ ...userData, id: newUser.uid })
  }

  const updateUserProfile = async (data: Partial<User>) => {
    if (!firebaseUser) return
    await UserService.updateProfile(firebaseUser.uid, data)
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

  const updateUserRole = async (userId: string, newRole: UserRole | undefined) => {
    if (!hasRole(user, 'maestro')) {
      throw new Error('Unauthorized: solo el maestro puede asignar roles')
    }
    await UserService.updateRole(userId, newRole)
    if (user && user.id === userId) {
      setUser({ ...user, rol: newRole })
    }
  }

  const updateUserTeams = async (userId: string, newTeams: TeamType[]) => {
    if (!hasRole(user, 'maestro') && !hasRole(user, 'admin')) {
      throw new Error('Unauthorized: se requiere rol admin o maestro para asignar equipos')
    }
    await UserService.updateTeams(userId, newTeams)
    if (user && user.id === userId) {
      const limitedTeams = newTeams.slice(0, 2)
      setUser({ ...user, equipos: limitedTeams })
    }
  }

  const getAllUsers = async (): Promise<User[]> => {
    return await UserService.getAll()
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
      updateUserTeams,
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
