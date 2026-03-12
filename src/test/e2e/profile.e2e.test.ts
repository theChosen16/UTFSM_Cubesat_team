import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { getTestFirebase, clearFirestoreData, clearAuthUsers } from '../emulator-config'

describe('Profile E2E', () => {
  const { auth, db } = getTestFirebase()
  let userUid: string

  beforeAll(async () => {
    await clearFirestoreData()
    await clearAuthUsers()

    const { user } = await createUserWithEmailAndPassword(auth, 'profile.test@usm.cl', 'Pass123!')
    userUid = user.uid
    await setDoc(doc(db, 'users', userUid), {
      email: 'profile.test@usm.cl',
      nombre: 'Profile',
      apellido: 'Test',
      createdAt: new Date(),
      isActive: true,
    })
  })

  afterAll(async () => {
    await signOut(auth)
    await clearFirestoreData()
    await clearAuthUsers()
  })

  it('should update nombre and apellido', async () => {
    await setDoc(doc(db, 'users', userUid), {
      nombre: 'Updated',
      apellido: 'Name',
    }, { merge: true })

    const updated = await getDoc(doc(db, 'users', userUid))
    expect(updated.data()!.nombre).toBe('Updated')
    expect(updated.data()!.apellido).toBe('Name')
  })

  it('should update teams selection', async () => {
    await setDoc(doc(db, 'users', userUid), {
      equipos: ['tecnico', 'manager'],
    }, { merge: true })

    const updated = await getDoc(doc(db, 'users', userUid))
    expect(updated.data()!.equipos).toEqual(['tecnico', 'manager'])
  })

  it('should update genero', async () => {
    await setDoc(doc(db, 'users', userUid), {
      genero: 'femenino',
    }, { merge: true })

    const updated = await getDoc(doc(db, 'users', userUid))
    expect(updated.data()!.genero).toBe('femenino')
  })

  it('should store photo as base64 data URL', async () => {
    const fakeBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    await setDoc(doc(db, 'users', userUid), {
      photoURL: fakeBase64,
    }, { merge: true })

    const updated = await getDoc(doc(db, 'users', userUid))
    expect(updated.data()!.photoURL).toBe(fakeBase64)
    expect(updated.data()!.photoURL).toMatch(/^data:image\//)
  })

  it('should store questionnaire data', async () => {
    const questionnaire = {
      intereses: 'Satellite communication systems',
      habilidades: 'Python, MATLAB, RF design',
      motivacion: 'Contributing to space exploration',
      disponibilidad: '10 horas/semana',
      proyectosPrevios: 'Amateur radio satellite tracker',
    }

    await setDoc(doc(db, 'users', userUid), { questionnaire }, { merge: true })

    const updated = await getDoc(doc(db, 'users', userUid))
    expect(updated.data()!.questionnaire).toEqual(questionnaire)
  })

  it('should store career and year fields', async () => {
    await setDoc(doc(db, 'users', userUid), {
      career: 'Ingeniería Civil Electrónica',
      year: '4to año',
    }, { merge: true })

    const updated = await getDoc(doc(db, 'users', userUid))
    expect(updated.data()!.career).toBe('Ingeniería Civil Electrónica')
    expect(updated.data()!.year).toBe('4to año')
  })

  it('should read another users profile data', async () => {
    // Create a second user
    await signOut(auth)
    const { user: other } = await createUserWithEmailAndPassword(auth, 'other.profile@usm.cl', 'Pass123!')
    await setDoc(doc(db, 'users', other.uid), {
      email: 'other.profile@usm.cl',
      nombre: 'Other',
      apellido: 'Person',
      rol: 'admin',
      equipos: ['relaciones_publicas'],
      createdAt: new Date(),
      isActive: true,
    })

    // Read the other user's profile
    const otherDoc = await getDoc(doc(db, 'users', other.uid))
    expect(otherDoc.exists()).toBe(true)
    expect(otherDoc.data()!.nombre).toBe('Other')
    expect(otherDoc.data()!.rol).toBe('admin')
    expect(otherDoc.data()!.equipos).toContain('relaciones_publicas')
  })
})
