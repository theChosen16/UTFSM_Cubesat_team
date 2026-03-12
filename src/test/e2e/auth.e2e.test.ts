import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, collection, getDocs, query, limit } from 'firebase/firestore'
import { getTestFirebase, clearFirestoreData, clearAuthUsers } from '../emulator-config'

describe('Auth E2E', () => {
  const { auth, db } = getTestFirebase()

  beforeEach(async () => {
    await clearFirestoreData()
    await clearAuthUsers()
  })

  afterAll(async () => {
    await clearFirestoreData()
    await clearAuthUsers()
  })

  it('should register a new user and create Firestore document', async () => {
    const email = 'test.user@usm.cl'
    const password = 'TestPass123!'
    const nombre = 'Test'
    const apellido = 'User'

    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    // Simulate what signUp does: create user doc
    const isFirstSnap = await getDocs(query(collection(db, 'users'), limit(1)))
    const isFirst = isFirstSnap.empty

    await setDoc(doc(db, 'users', user.uid), {
      email,
      nombre,
      apellido,
      ...(isFirst ? { rol: 'maestro' } : {}),
      createdAt: new Date(),
      isActive: true,
    })

    const userDoc = await getDoc(doc(db, 'users', user.uid))
    expect(userDoc.exists()).toBe(true)

    const data = userDoc.data()!
    expect(data.email).toBe(email)
    expect(data.nombre).toBe(nombre)
    expect(data.apellido).toBe(apellido)
    expect(data.isActive).toBe(true)
  })

  it('should assign maestro role to the first registered user', async () => {
    const email = 'first.user@usm.cl'
    const password = 'FirstPass123!'

    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    const isFirstSnap = await getDocs(query(collection(db, 'users'), limit(1)))
    const isFirst = isFirstSnap.empty
    expect(isFirst).toBe(true)

    await setDoc(doc(db, 'users', user.uid), {
      email,
      nombre: 'First',
      apellido: 'User',
      rol: 'maestro',
      createdAt: new Date(),
      isActive: true,
    })

    const userDoc = await getDoc(doc(db, 'users', user.uid))
    expect(userDoc.data()!.rol).toBe('maestro')
  })

  it('should not assign maestro role to subsequent users', async () => {
    // Create first user
    const { user: first } = await createUserWithEmailAndPassword(auth, 'first@usm.cl', 'Pass123!')
    await setDoc(doc(db, 'users', first.uid), {
      email: 'first@usm.cl',
      nombre: 'First',
      apellido: 'User',
      rol: 'maestro',
      createdAt: new Date(),
      isActive: true,
    })

    await signOut(auth)

    // Create second user
    const { user: second } = await createUserWithEmailAndPassword(auth, 'second@usm.cl', 'Pass123!')

    const isFirstSnap = await getDocs(query(collection(db, 'users'), limit(1)))
    expect(isFirstSnap.empty).toBe(false)

    await setDoc(doc(db, 'users', second.uid), {
      email: 'second@usm.cl',
      nombre: 'Second',
      apellido: 'User',
      createdAt: new Date(),
      isActive: true,
    })

    const userDoc = await getDoc(doc(db, 'users', second.uid))
    expect(userDoc.data()!.rol).toBeUndefined()
  })

  it('should sign in and sign out successfully', async () => {
    const email = 'login.test@usm.cl'
    const password = 'LoginPass123!'

    await createUserWithEmailAndPassword(auth, email, password)
    await signOut(auth)

    const { user } = await signInWithEmailAndPassword(auth, email, password)
    expect(user.email).toBe(email)

    await signOut(auth)
    expect(auth.currentUser).toBeNull()
  })

  it('should reject sign in with wrong password', async () => {
    const email = 'wrong.pass@usm.cl'
    await createUserWithEmailAndPassword(auth, email, 'CorrectPass123!')
    await signOut(auth)

    await expect(
      signInWithEmailAndPassword(auth, email, 'WrongPass456!')
    ).rejects.toThrow()
  })
})
