import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile as updateAuthProfile,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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
  /**
   * Whether a `/users/{uid}` profile document exists for the signed-in account.
   *
   * `null` while it is still unknown. An account whose institutional address is not verified
   * AND that has no profile yet cannot read or write anything (see `isInstitutional()` in
   * firestore.rules), so this is what tells the UI to show the verification gate instead of a
   * workspace full of permission errors.
   */
  hasProfile: boolean | null
  emailVerified: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, nombre: string, apellido: string) => Promise<void>
  signOut: () => Promise<void>
  updateUserRole: (userId: string, newRole: UserRole | undefined) => Promise<void>
  updateUserTeams: (userId: string, newTeams: TeamType[]) => Promise<void>
  updateUserProfile: (data: Partial<User>) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  sendVerificationEmail: () => Promise<void>
  refreshVerificationStatus: () => Promise<boolean>
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
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)

  useEffect(() => {
    let isMounted = true
    let authStateVersion = 0

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const currentVersion = ++authStateVersion

      if (!isMounted) {
        return
      }

      setFirebaseUser(fbUser)
      setEmailVerified(Boolean(fbUser?.emailVerified))
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
            // Auto-repair: backfill fields the Firestore profile is missing from the Auth record.
            //
            // 'nombre'/'apellido' are repaired even when the email is present. mapFirestoreUser
            // derives a display name from the email when the document has none, so the UI shows a
            // name the profile never actually stored — and the notification rules verify the
            // *stored* name (an identity check cannot trust a value the sender supplies). Healing
            // the document keeps what the client shows and what the rules accept in agreement,
            // which is what lets those rules stay strict instead of carrying a "no name stored,
            // allow anything" exemption that any member could re-enter by blanking their name.
            // Each patch is written SEPARATELY and best-effort. 'email' is deliberately absent
            // from the rules' self-update allowlist (a member who could rewrite their stored
            // address would redirect the digest and misrepresent themselves in every admin
            // listing), so a regular member's email repair is always denied. Bundling it with
            // the name fields made that denial reject the whole write, which meant the names —
            // the part the rules *do* allow — were never healed on exactly the legacy documents
            // this repair exists for. And because the write sat inside the try whose catch falls
            // back to a role-less user, a denied repair also threw away the real profile (role
            // included) for the rest of the session. Repairing is a convenience: it must never
            // decide whether the profile loads.
            const repairProfile = async (patch: Record<string, string>) => {
              if (Object.keys(patch).length === 0) return
              try {
                await setDoc(doc(db, COLLECTIONS.USERS, fbUser.uid), patch, { merge: true })
                Object.assign(userData, patch)
              } catch (repairError) {
                logger.warn('Profile auto-repair write was rejected', {
                  fields: Object.keys(patch),
                  error: repairError instanceof Error ? repairError : undefined,
                })
              }
            }

            // Only a maestro/admin write can carry 'email' past the rules; for everyone else this
            // one no-ops, without taking the name repair down with it.
            if (!userData.email && fbUser.email) {
              await repairProfile({ email: fbUser.email })
            }

            if (!userData.nombre || !userData.apellido) {
              const displayName = fbUser.displayName?.trim()
              const derived = displayName
                ? {
                    nombre: displayName.split(' ')[0],
                    apellido: displayName.split(' ').slice(1).join(' '),
                  }
                : extractFullNameFromEmail(
                    (typeof userData.email === 'string' && userData.email) || fbUser.email || ''
                  )
              const namePatch: Record<string, string> = {}
              // Truncated to the 80-character ceiling the rules enforce on these fields, so an
              // unusually long Auth displayName cannot make the repair write undeliverable.
              if (!userData.nombre && derived.nombre) namePatch.nombre = derived.nombre.slice(0, 80)
              if (!userData.apellido && derived.apellido) namePatch.apellido = derived.apellido.slice(0, 80)
              await repairProfile(namePatch)
            }

            // Re-check staleness: the repair writes above are await points that did not exist
            // between the check after getDoc and this setUser. If the user signs out (or another
            // account signs in) while a repair is in flight, that handler has already run
            // setUser(null) — and this continuation, still holding the previous account's data,
            // would overwrite it and show a signed-out person as signed in with the old profile.
            // Same class of bug as the cross-account chat leak this branch closes: state captured
            // before an await has to be revalidated after it.
            if (!isMounted || authStateVersion !== currentVersion) {
              return
            }

            setHasProfile(true)
            setUser(mapFirestoreUser(fbUser.uid, userData, fallbackUser))
          } else if (fbUser.emailVerified) {
            // Deferred profile provisioning.
            //
            // Registration used to write `/users/{uid}` immediately after
            // createUserWithEmailAndPassword, i.e. for an address nobody had proven they own.
            // The rules now require a verified institutional address to create a profile
            // (otherwise an unverified newcomer would grandfather themselves past
            // `isInstitutional()` in one write), so the document is created here instead — on
            // the first sign-in that carries a verified token. The display name captured at
            // registration survives the gap on the Firebase Auth record.
            const displayName = fbUser.displayName?.trim()
            const derived = displayName
              ? {
                  nombre: displayName.split(' ')[0],
                  apellido: displayName.split(' ').slice(1).join(' '),
                }
              : extractFullNameFromEmail(fbUser.email || '')
            const provisioned: Omit<User, 'id'> = {
              email: fbUser.email || '',
              nombre: (derived.nombre || '').slice(0, 80),
              apellido: (derived.apellido || '').slice(0, 80),
              createdAt: new Date(),
              isActive: true,
            }

            try {
              await setDoc(doc(db, COLLECTIONS.USERS, fbUser.uid), provisioned)
              if (!isMounted || authStateVersion !== currentVersion) {
                return
              }
              setHasProfile(true)
              setUser({ ...provisioned, id: fbUser.uid })
            } catch (provisionError) {
              if (!isMounted || authStateVersion !== currentVersion) {
                return
              }
              logger.warn('Could not provision the workspace profile for a verified account', {
                error: provisionError instanceof Error ? provisionError : undefined,
              })
              setHasProfile(false)
              setUser(fallbackUser)
            }
          } else {
            // Verified === false and no profile: the account exists in Firebase Auth but is not
            // a workspace member yet. Every Firestore path is denied by the rules, so the UI
            // shows the verification gate rather than a dashboard full of errors.
            setHasProfile(false)
            setUser(fallbackUser)
          }
        } catch (error) {
          if (!isMounted || authStateVersion !== currentVersion) {
            return
          }

          logger.warn('Could not fetch Firestore user data – may be blocked by ad-blocker', { error: error instanceof Error ? error : undefined })
          // A denied read is exactly what an unverified, not-yet-provisioned account gets, so
          // do not claim a profile exists; the gate decides from `emailVerified` as well.
          setHasProfile(fbUser.emailVerified ? null : false)
          setUser(fallbackUser)
        } finally {
          if (isMounted && authStateVersion === currentVersion) {
            setLoading(false)
          }
        }
      } else {
        setUser(null)
        setHasProfile(null)
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

    // Registration NEVER provisions a workspace profile either, because at this point nobody
    // has proven they can receive mail at the address. Firebase's sign-up endpoint is public
    // and keyed by the Web API key that ships in the client bundle, so an @usm.cl address is
    // free to assert; without verification the "private institutional workspace" was open to
    // anyone on the internet. The profile — the document that makes an account a member — is
    // created on the first sign-in with a VERIFIED address (see the auth-state handler above),
    // which is also what firestore.rules now requires.
    //
    // The name typed during registration is parked on the Firebase Auth record so it survives
    // the round-trip through the verification e-mail.
    const displayName = `${nombre} ${apellido}`.trim()
    if (displayName) {
      await updateAuthProfile(newUser, { displayName }).catch(profileError => {
        logger.warn('Could not store the display name on the Auth record', {
          error: profileError instanceof Error ? profileError : undefined,
        })
      })
    }

    await sendEmailVerification(newUser).catch(verificationError => {
      // Non-fatal: the account exists and the gate offers a "resend" action.
      logger.warn('Could not send the verification e-mail at registration', {
        error: verificationError instanceof Error ? verificationError : undefined,
      })
    })

    // Registration NEVER grants a role. The previous flow claimed a one-time
    // `users/_bootstrap_lock` document inside a transaction and, when it won the claim, wrote
    // `rol: 'maestro'` on the new profile — with the Firestore rules authorizing that write
    // precisely because the lock (which the same client had just created) named this uid. On any
    // workspace where the lock is absent — every project provisioned before the lock existed, or
    // one where a maestro deleted the document — the next person to register therefore took over
    // the whole workspace, and the only prerequisite was an @usm.cl / @sansano.usm.cl address.
    //
    // The first maestro is now provisioned once from the Firebase console (server-side writes
    // bypass the security rules); see SECURITY.md → "Provisioning the first maestro".
    setHasProfile(false)
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

  /** Re-sends the institutional-address verification e-mail to the signed-in account. */
  const sendVerificationEmail = async () => {
    const current = auth.currentUser
    if (!current) throw new Error('No hay una sesión activa')
    await sendEmailVerification(current)
  }

  /**
   * Re-reads the verification state from Firebase and, when it has flipped, forces a fresh ID
   * token.
   *
   * `email_verified` is a claim baked into the ID token at issue time, and firestore.rules
   * reads it from there. Without the forced refresh the browser would keep presenting the old
   * (unverified) token for up to an hour after the user clicks the link, so the workspace would
   * stay locked even though the account is verified.
   */
  const refreshVerificationStatus = async (): Promise<boolean> => {
    const current = auth.currentUser
    if (!current) return false
    await current.reload()
    const verified = auth.currentUser?.emailVerified ?? false
    if (verified) {
      await auth.currentUser?.getIdToken(true).catch(() => undefined)
    }
    setEmailVerified(verified)
    setFirebaseUser(auth.currentUser)
    return verified
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null)
    setFirebaseUser(null)
    setHasProfile(null)
    setEmailVerified(false)
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
      hasProfile,
      emailVerified,
      signIn,
      signUp,
      signOut,
      updateUserRole,
      updateUserTeams,
      updateUserProfile,
      resetPassword,
      sendVerificationEmail,
      refreshVerificationStatus,
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
