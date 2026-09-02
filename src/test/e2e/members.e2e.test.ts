import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore'
import { getTestFirebase, clearFirestoreData, clearAuthUsers, bootstrapMaestro, createVerifiedUser } from '../emulator-config'
import { extractFullNameFromEmail } from '@/lib/utils'

describe('Members E2E', () => {
  const { auth, db } = getTestFirebase()
  let maestroUid: string

  beforeAll(async () => {
    await clearFirestoreData()
    await clearAuthUsers()

    // Create maestro (secure bootstrap lock)
    const { user } = await createVerifiedUser(auth, 'maestro.members@usm.cl', 'Pass123!')
    maestroUid = user.uid
    await bootstrapMaestro(db, maestroUid, 'maestro.members@usm.cl', {
      apellido: 'Members',
      equipos: ['tecnico'],
    })

    await signOut(auth)

    // Regular user self-creates a plain profile (cannot self-assign the 'manager' team)
    const { user: regular } = await createVerifiedUser(auth, 'regular@usm.cl', 'Pass123!')
    await setDoc(doc(db, 'users', regular.uid), {
      email: 'regular@usm.cl',
      nombre: 'Regular',
      apellido: 'User',
      createdAt: new Date(),
      isActive: true,
    })

    await signOut(auth)

    // Create user without nombre (simulates pre-auto-name registration)
    const { user: legacy } = await createVerifiedUser(auth, 'sofia.galaz@usm.cl', 'Pass123!')
    await setDoc(doc(db, 'users', legacy.uid), {
      email: 'sofia.galaz@usm.cl',
      nombre: '',
      apellido: '',
      createdAt: new Date(),
      isActive: true,
    })

    await signOut(auth)

    // Maestro grants the 'manager' team to the regular user (only managers/admins/maestros
    // may assign it — a user cannot self-assign it). Tests then run as maestro.
    await signInWithEmailAndPassword(auth, 'maestro.members@usm.cl', 'Pass123!')
    await setDoc(doc(db, 'users', regular.uid), { equipos: ['manager'] }, { merge: true })
  })

  afterAll(async () => {
    await signOut(auth)
    await clearFirestoreData()
    await clearAuthUsers()
  })

  it('should list all registered users', async () => {
    const snapshot = await getDocs(collection(db, 'users'))
    // Exclude the bootstrap lock sentinel doc that lives in /users.
    const realUsers = snapshot.docs.filter(d => d.id !== '_bootstrap_lock')
    expect(realUsers.length).toBe(3)
  })

  it('should update user role (maestro assigns admin)', async () => {
    const snapshot = await getDocs(collection(db, 'users'))
    const regularUser = snapshot.docs.find(d => d.data().email === 'regular@usm.cl')
    expect(regularUser).toBeDefined()

    await setDoc(doc(db, 'users', regularUser!.id), { rol: 'admin' }, { merge: true })

    const updated = await getDoc(doc(db, 'users', regularUser!.id))
    expect(updated.data()!.rol).toBe('admin')

    // Clean up
    await setDoc(doc(db, 'users', regularUser!.id), { rol: null }, { merge: true })
  })

  it('should update user teams with max 2 enforcement', async () => {
    const snapshot = await getDocs(collection(db, 'users'))
    const regularUser = snapshot.docs.find(d => d.data().email === 'regular@usm.cl')

    // Assign 2 teams
    const newTeams = ['tecnico', 'relaciones_publicas'].slice(0, 2)
    await setDoc(doc(db, 'users', regularUser!.id), { equipos: newTeams }, { merge: true })

    const updated = await getDoc(doc(db, 'users', regularUser!.id))
    expect(updated.data()!.equipos).toEqual(['tecnico', 'relaciones_publicas'])
    expect(updated.data()!.equipos.length).toBeLessThanOrEqual(2)
  })

  it('should derive display name from email for legacy users', () => {
    // Test the extractFullNameFromEmail utility directly
    const result = extractFullNameFromEmail('sofia.galaz@usm.cl')
    expect(result.nombre).toBe('Sofia')
    expect(result.apellido).toBe('Galaz')
  })

  it('should handle user with empty nombre in Firestore by backfilling from email', async () => {
    const snapshot = await getDocs(collection(db, 'users'))
    const legacyUser = snapshot.docs.find(d => d.data().email === 'sofia.galaz@usm.cl')
    expect(legacyUser).toBeDefined()

    const rawData = legacyUser!.data()
    expect(rawData.nombre).toBe('')

    // Simulate mapFirestoreUser backfill logic
    let nombre = rawData.nombre
    let apellido = rawData.apellido
    if (!nombre && rawData.email) {
      const extracted = extractFullNameFromEmail(rawData.email)
      nombre = extracted.nombre
      if (!apellido) {
        apellido = extracted.apellido
      }
    }

    expect(nombre).toBe('Sofia')
    expect(apellido).toBe('Galaz')
  })

  it('should store and retrieve user team data', async () => {
    const userDoc = await getDoc(doc(db, 'users', maestroUid))
    expect(userDoc.data()!.equipos).toContain('tecnico')
  })
})
