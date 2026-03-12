import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore'
import { getTestFirebase, clearFirestoreData, clearAuthUsers } from '../emulator-config'

describe('Projects E2E', () => {
  const { auth, db } = getTestFirebase()
  let maestroUid: string

  beforeAll(async () => {
    await clearFirestoreData()
    await clearAuthUsers()

    // Create maestro user
    const { user } = await createUserWithEmailAndPassword(auth, 'maestro@usm.cl', 'Pass123!')
    maestroUid = user.uid
    await setDoc(doc(db, 'users', maestroUid), {
      email: 'maestro@usm.cl',
      nombre: 'Maestro',
      apellido: 'User',
      rol: 'maestro',
      createdAt: new Date(),
      isActive: true,
    })
  })

  afterAll(async () => {
    await signOut(auth)
    await clearFirestoreData()
    await clearAuthUsers()
  })

  beforeEach(async () => {
    // Clear only projects collection
    const snapshot = await getDocs(collection(db, 'projects'))
    const deletePromises = snapshot.docs.map(d =>
      setDoc(doc(db, 'projects', d.id), { _deleted: true })
    )
    await Promise.all(deletePromises)
  })

  it('should create a project and store it in Firestore', async () => {
    const projectData = {
      nombre: 'CubeSat Alpha',
      descripcion: 'First nano-satellite project',
      estado: 'planificacion',
      creadoPor: maestroUid,
      asignadoA: [],
      prioridad: 'alta',
      progress: 0,
      createdAt: Timestamp.now(),
    }

    const docRef = await addDoc(collection(db, 'projects'), projectData)
    const stored = await getDoc(docRef)

    expect(stored.exists()).toBe(true)
    expect(stored.data()!.nombre).toBe('CubeSat Alpha')
    expect(stored.data()!.estado).toBe('planificacion')
    expect(stored.data()!.prioridad).toBe('alta')
  })

  it('should list all projects from Firestore', async () => {
    // Create two projects
    await addDoc(collection(db, 'projects'), {
      nombre: 'Project A',
      descripcion: 'Desc A',
      estado: 'planificacion',
      creadoPor: maestroUid,
      asignadoA: [],
      createdAt: Timestamp.now(),
    })
    await addDoc(collection(db, 'projects'), {
      nombre: 'Project B',
      descripcion: 'Desc B',
      estado: 'en_progreso',
      creadoPor: maestroUid,
      asignadoA: [],
      createdAt: Timestamp.now(),
    })

    const snapshot = await getDocs(collection(db, 'projects'))
    const projects = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !(p as Record<string, unknown>)._deleted)

    expect(projects.length).toBe(2)
    expect(projects.map(p => (p as Record<string, unknown>).nombre)).toContain('Project A')
    expect(projects.map(p => (p as Record<string, unknown>).nombre)).toContain('Project B')
  })

  it('should update project status', async () => {
    const docRef = await addDoc(collection(db, 'projects'), {
      nombre: 'Status Test',
      descripcion: 'Testing status update',
      estado: 'planificacion',
      creadoPor: maestroUid,
      asignadoA: [],
      createdAt: Timestamp.now(),
    })

    await setDoc(docRef, { estado: 'en_progreso' }, { merge: true })

    const updated = await getDoc(docRef)
    expect(updated.data()!.estado).toBe('en_progreso')
  })

  it('should store project with deadline', async () => {
    const deadline = new Date('2026-12-31')
    const docRef = await addDoc(collection(db, 'projects'), {
      nombre: 'Deadline Project',
      descripcion: 'Has a deadline',
      estado: 'planificacion',
      creadoPor: maestroUid,
      asignadoA: [],
      fechaLimite: Timestamp.fromDate(deadline),
      createdAt: Timestamp.now(),
    })

    const stored = await getDoc(docRef)
    const data = stored.data()!
    expect(data.fechaLimite).toBeDefined()
    expect(data.fechaLimite.toDate().getFullYear()).toBe(2026)
  })

  it('should store project with assigned members', async () => {
    const docRef = await addDoc(collection(db, 'projects'), {
      nombre: 'Team Project',
      descripcion: 'Assigned to members',
      estado: 'planificacion',
      creadoPor: maestroUid,
      asignadoA: ['user1', 'user2', 'user3'],
      createdAt: Timestamp.now(),
    })

    const stored = await getDoc(docRef)
    expect(stored.data()!.asignadoA).toEqual(['user1', 'user2', 'user3'])
  })
})
