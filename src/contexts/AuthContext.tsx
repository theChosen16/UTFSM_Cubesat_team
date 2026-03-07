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
import { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, nombre: string, apellido: string) => Promise<void>
  signOut: () => Promise<void>
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>
  updateUserProfile: (data: Partial<User>) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  getAllUsers: () => Promise<User[]>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data() as User
            setUser({ ...userData, id: fbUser.uid })
          } else {
            setUser({
              id: fbUser.uid,
              email: fbUser.email || '',
              nombre: fbUser.displayName?.split(' ')[0] || '',
              apellido: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
              rol: 'tecnico',
              createdAt: new Date(),
              isActive: true,
            })
          }
        } catch (error) {
          console.warn('No se pudo obtener datos de Firestore. Puede estar bloqueado por un bloqueador de anuncios.', error)
          setUser({
            id: fbUser.uid,
            email: fbUser.email || '',
            nombre: fbUser.displayName?.split(' ')[0] || '',
            apellido: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
            rol: 'tecnico',
            createdAt: new Date(),
            isActive: true,
          })
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
      // If we can't read (due to rules), assume it's not the first or handle accordingly
      console.error("Error checking first user:", error)
      isFirstUser = false 
    }
    
    const userData: Omit<User, 'id'> = {
      email,
      nombre,
      apellido,
      rol: isFirstUser ? 'maestro' : 'tecnico',
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

  const getAllUsers = async (): Promise<User[]> => {
    const usersSnapshot = await getDocs(collection(db, 'users'))
    return usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User))
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
