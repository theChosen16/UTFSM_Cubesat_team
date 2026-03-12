import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  Timestamp,
  query,
  where,
} from 'firebase/firestore'
import { getTestFirebase, clearFirestoreData, clearAuthUsers } from '../emulator-config'

describe('Tasks E2E', () => {
  const { auth, db } = getTestFirebase()
  let maestroUid: string
  let projectId: string

  beforeAll(async () => {
    await clearFirestoreData()
    await clearAuthUsers()

    // Create maestro user
    const { user } = await createUserWithEmailAndPassword(auth, 'maestro.tasks@usm.cl', 'Pass123!')
    maestroUid = user.uid
    await setDoc(doc(db, 'users', maestroUid), {
      email: 'maestro.tasks@usm.cl',
      nombre: 'Maestro',
      apellido: 'Tasks',
      rol: 'maestro',
      createdAt: new Date(),
      isActive: true,
    })

    // Create a project for tasks
    const projectRef = await addDoc(collection(db, 'projects'), {
      nombre: 'Task Project',
      descripcion: 'Project for task testing',
      estado: 'en_progreso',
      creadoPor: maestroUid,
      asignadoA: [],
      createdAt: Timestamp.now(),
    })
    projectId = projectRef.id
  })

  afterAll(async () => {
    await signOut(auth)
    await clearFirestoreData()
    await clearAuthUsers()
  })

  it('should create a task assigned to a project', async () => {
    const taskData = {
      titulo: 'Design ADCS subsystem',
      descripcion: 'Design the attitude determination and control system',
      projectId,
      estado: 'pendiente',
      asignadoA: [maestroUid],
      equipo: 'tecnico',
      prioridad: 'alta',
      creadoPor: maestroUid,
      createdAt: Timestamp.now(),
    }

    const taskRef = await addDoc(collection(db, 'tasks'), taskData)
    const stored = await getDoc(taskRef)

    expect(stored.exists()).toBe(true)
    expect(stored.data()!.titulo).toBe('Design ADCS subsystem')
    expect(stored.data()!.projectId).toBe(projectId)
    expect(stored.data()!.equipo).toBe('tecnico')
    expect(stored.data()!.prioridad).toBe('alta')
    expect(stored.data()!.estado).toBe('pendiente')
  })

  it('should update task status to en_progreso and then completado', async () => {
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Status flow test',
      descripcion: 'Test status transitions',
      projectId,
      estado: 'pendiente',
      asignadoA: [maestroUid],
      equipo: 'tecnico',
      prioridad: 'media',
      creadoPor: maestroUid,
      createdAt: Timestamp.now(),
    })

    // Move to en_progreso
    await setDoc(taskRef, { estado: 'en_progreso' }, { merge: true })
    let updated = await getDoc(taskRef)
    expect(updated.data()!.estado).toBe('en_progreso')

    // Move to completado
    await setDoc(taskRef, { estado: 'completado' }, { merge: true })
    updated = await getDoc(taskRef)
    expect(updated.data()!.estado).toBe('completado')
  })

  it('should assign task to multiple users', async () => {
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Multi-assign task',
      descripcion: 'Assigned to multiple members',
      projectId,
      estado: 'pendiente',
      asignadoA: ['user1', 'user2', 'user3'],
      equipo: 'manager',
      prioridad: 'baja',
      creadoPor: maestroUid,
      createdAt: Timestamp.now(),
    })

    const stored = await getDoc(taskRef)
    expect(stored.data()!.asignadoA).toEqual(['user1', 'user2', 'user3'])
    expect(stored.data()!.equipo).toBe('manager')
  })

  it('should query tasks by project', async () => {
    // Add a task to the project
    await addDoc(collection(db, 'tasks'), {
      titulo: 'Queried task',
      descripcion: 'For query test',
      projectId,
      estado: 'pendiente',
      asignadoA: [],
      equipo: 'tecnico',
      prioridad: 'media',
      creadoPor: maestroUid,
      createdAt: Timestamp.now(),
    })

    const snapshot = await getDocs(
      query(collection(db, 'tasks'), where('projectId', '==', projectId))
    )

    expect(snapshot.size).toBeGreaterThanOrEqual(1)
    snapshot.docs.forEach(d => {
      expect(d.data().projectId).toBe(projectId)
    })
  })

  it('should support all priority levels', async () => {
    for (const prioridad of ['alta', 'media', 'baja'] as const) {
      const ref = await addDoc(collection(db, 'tasks'), {
        titulo: `Priority ${prioridad}`,
        descripcion: `Testing ${prioridad} priority`,
        projectId,
        estado: 'pendiente',
        asignadoA: [],
        equipo: 'tecnico',
        prioridad,
        creadoPor: maestroUid,
        createdAt: Timestamp.now(),
      })

      const stored = await getDoc(ref)
      expect(stored.data()!.prioridad).toBe(prioridad)
    }
  })
})
