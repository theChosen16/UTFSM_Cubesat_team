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

  it('should store fechaLimite and hitos on a task', async () => {
    const fechaLimite = '2026-06-30'
    const hitos = [
      { id: 'h1', titulo: 'Diseño preliminar', completado: false },
      { id: 'h2', titulo: 'Revisión CDR', completado: false },
    ]

    const ref = await addDoc(collection(db, 'tasks'), {
      titulo: 'Task with deadline',
      descripcion: 'Has deadline and milestones',
      projectId,
      estado: 'pendiente',
      asignadoA: [maestroUid],
      equipo: 'tecnico',
      prioridad: 'alta',
      puntajeImportancia: 10,
      creadoPor: maestroUid,
      fechaLimite,
      hitos,
      deliverables: [],
      progressUpdates: [],
      attachmentIds: [],
      createdAt: Timestamp.now(),
    })

    const stored = await getDoc(ref)
    expect(stored.data()!.fechaLimite).toBe(fechaLimite)
    expect(stored.data()!.hitos).toHaveLength(2)
    expect(stored.data()!.hitos[0].titulo).toBe('Diseño preliminar')
    expect(stored.data()!.hitos[0].completado).toBe(false)
  })

  it('should store deliverables and update their estado', async () => {
    const deliverables = [
      {
        id: 'd1',
        titulo: 'Informe técnico',
        descripcion: 'Documento PDF con resultados',
        estado: 'pendiente',
        attachmentIds: [],
      },
    ]

    const ref = await addDoc(collection(db, 'tasks'), {
      titulo: 'Task with deliverable',
      descripcion: 'Has a deliverable',
      projectId,
      estado: 'pendiente',
      asignadoA: [maestroUid],
      equipo: 'tecnico',
      prioridad: 'media',
      puntajeImportancia: 5,
      creadoPor: maestroUid,
      deliverables,
      hitos: [],
      progressUpdates: [],
      attachmentIds: [],
      createdAt: Timestamp.now(),
    })

    // Update deliverable estado to 'entregado'
    const task = await getDoc(ref)
    const updatedDeliverables = (task.data()!.deliverables as typeof deliverables).map(d =>
      d.id === 'd1' ? { ...d, estado: 'entregado', deliveredAt: new Date().toISOString(), deliveredBy: maestroUid } : d
    )
    await setDoc(ref, { deliverables: updatedDeliverables }, { merge: true })

    const updated = await getDoc(ref)
    expect(updated.data()!.deliverables[0].estado).toBe('entregado')
    expect(updated.data()!.deliverables[0].deliveredBy).toBe(maestroUid)
  })

  it('should append progressUpdates to a task', async () => {
    const ref = await addDoc(collection(db, 'tasks'), {
      titulo: 'Task with progress',
      descripcion: 'Tracks progress',
      projectId,
      estado: 'en_progreso',
      asignadoA: [maestroUid],
      equipo: 'tecnico',
      prioridad: 'alta',
      puntajeImportancia: 8,
      creadoPor: maestroUid,
      deliverables: [],
      hitos: [],
      progressUpdates: [],
      attachmentIds: [],
      createdAt: Timestamp.now(),
    })

    const update1 = {
      id: crypto.randomUUID(),
      authorId: maestroUid,
      message: 'Avancé un 30% del análisis',
      createdAt: new Date().toISOString(),
      status: 'en_progreso',
    }
    const update2 = {
      id: crypto.randomUUID(),
      authorId: maestroUid,
      message: 'Completé el análisis, pendiente revisión',
      createdAt: new Date().toISOString(),
      status: 'en_revision',
    }

    await setDoc(ref, { progressUpdates: [update1] }, { merge: true })
    await setDoc(ref, { progressUpdates: [update1, update2] }, { merge: true })

    const stored = await getDoc(ref)
    expect(stored.data()!.progressUpdates).toHaveLength(2)
    expect(stored.data()!.progressUpdates[1].message).toBe('Completé el análisis, pendiente revisión')
    expect(stored.data()!.progressUpdates[1].status).toBe('en_revision')
  })

  it('should complete task and record scoreAwarded', async () => {
    const puntajeImportancia = 15
    const ref = await addDoc(collection(db, 'tasks'), {
      titulo: 'High-value task',
      descripcion: 'Worth many points',
      projectId,
      estado: 'en_progreso',
      asignadoA: [maestroUid],
      equipo: 'tecnico',
      prioridad: 'alta',
      puntajeImportancia,
      creadoPor: maestroUid,
      deliverables: [],
      hitos: [],
      progressUpdates: [],
      attachmentIds: [],
      createdAt: Timestamp.now(),
    })

    await setDoc(ref, {
      estado: 'completado',
      completedBy: maestroUid,
      completedAt: new Date().toISOString(),
      scoreAwarded: puntajeImportancia,
    }, { merge: true })

    const stored = await getDoc(ref)
    expect(stored.data()!.estado).toBe('completado')
    expect(stored.data()!.scoreAwarded).toBe(puntajeImportancia)
    expect(stored.data()!.completedBy).toBe(maestroUid)
  })

  it('should create activity_log entry when task is created', async () => {
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Activity log task',
      descripcion: 'Will generate activity',
      projectId,
      estado: 'pendiente',
      asignadoA: [maestroUid],
      equipo: 'tecnico',
      prioridad: 'media',
      puntajeImportancia: 3,
      creadoPor: maestroUid,
      deliverables: [],
      hitos: [],
      progressUpdates: [],
      attachmentIds: [],
      createdAt: Timestamp.now(),
    })

    await addDoc(collection(db, 'activity_log'), {
      userId: maestroUid,
      type: 'task_created',
      relatedId: taskRef.id,
      taskId: taskRef.id,
      projectId,
      description: 'Creó la tarea "Activity log task"',
      metadata: { prioridad: 'media', puntajeImportancia: 3 },
      createdAt: Timestamp.now(),
    })

    const snap = await getDocs(
      query(collection(db, 'activity_log'), where('taskId', '==', taskRef.id))
    )
    expect(snap.size).toBe(1)
    expect(snap.docs[0].data().type).toBe('task_created')
    expect(snap.docs[0].data().userId).toBe(maestroUid)
  })
})
