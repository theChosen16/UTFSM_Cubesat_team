import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore'
import { getTestFirebase, clearFirestoreData, clearAuthUsers } from '../emulator-config'

/**
 * Validates the security-hardening rules added during the cybersecurity audit:
 *  - users.create cannot self-assign rol/roles, isActive:false or the 'manager' team
 *  - only the genuine first registrant (matching the bootstrap lock uid) may become maestro
 *  - an assigned member cannot inflate task scoreAwarded beyond the manager-set importance
 *  - /mail can only be enqueued by workspace managers
 */
describe('Security rules — privilege escalation & integrity', () => {
  const { auth, db } = getTestFirebase()
  const PW = 'Pass123!'

  const expectDenied = (p: Promise<unknown>) =>
    expect(p).rejects.toThrow(/permission|insufficient|denied/i)

  /** Replicates the real signup bootstrap: claim the lock, then create the maestro doc. */
  async function bootstrapMaestro(email: string): Promise<string> {
    const { user } = await createUserWithEmailAndPassword(auth, email, PW)
    await setDoc(doc(db, 'users', '_bootstrap_lock'), {
      maestroUid: user.uid,
      createdAt: new Date(),
    })
    await setDoc(doc(db, 'users', user.uid), {
      email,
      nombre: 'Master',
      apellido: 'Boot',
      rol: 'maestro',
      createdAt: new Date(),
      isActive: true,
    })
    return user.uid
  }

  beforeEach(async () => {
    await clearFirestoreData()
    await clearAuthUsers()
  })

  afterAll(async () => {
    await signOut(auth).catch(() => undefined)
    await clearFirestoreData()
    await clearAuthUsers()
  })

  it('allows the genuine first user to bootstrap as maestro', async () => {
    const uid = await bootstrapMaestro('founder@usm.cl')
    const snap = await getDoc(doc(db, 'users', uid))
    expect(snap.data()!.rol).toBe('maestro')
  })

  it('blocks a normal user from self-assigning rol:maestro on create', async () => {
    await bootstrapMaestro('boss1@usm.cl')
    await signOut(auth)

    const { user } = await createUserWithEmailAndPassword(auth, 'attacker@usm.cl', PW)
    await expectDenied(
      setDoc(doc(db, 'users', user.uid), {
        email: 'attacker@usm.cl',
        nombre: 'Eve',
        apellido: 'X',
        rol: 'maestro',
        createdAt: new Date(),
        isActive: true,
      })
    )
  })

  it('blocks self-assigning the manager team on create', async () => {
    await bootstrapMaestro('boss2@usm.cl')
    await signOut(auth)

    const { user } = await createUserWithEmailAndPassword(auth, 'eve2@usm.cl', PW)
    await expectDenied(
      setDoc(doc(db, 'users', user.uid), {
        email: 'eve2@usm.cl',
        nombre: 'Eve',
        apellido: 'X',
        equipos: ['manager'],
        createdAt: new Date(),
        isActive: true,
      })
    )
  })

  it('allows a normal self-create without privileged fields', async () => {
    await bootstrapMaestro('boss3@usm.cl')
    await signOut(auth)

    const { user } = await createUserWithEmailAndPassword(auth, 'reg@usm.cl', PW)
    await setDoc(doc(db, 'users', user.uid), {
      email: 'reg@usm.cl',
      nombre: 'Reg',
      apellido: 'User',
      equipos: ['tecnico'],
      createdAt: new Date(),
      isActive: true,
    })
    const snap = await getDoc(doc(db, 'users', user.uid))
    expect(snap.data()!.rol).toBeUndefined()
  })

  it('blocks an assigned member from inflating scoreAwarded above puntajeImportancia', async () => {
    const maestroEmail = 'mgr@usm.cl'
    await bootstrapMaestro(maestroEmail)

    // Member registers (this signs in as the member) and creates a plain profile.
    const { user: member } = await createUserWithEmailAndPassword(auth, 'member@usm.cl', PW)
    const memberUid = member.uid
    await setDoc(doc(db, 'users', memberUid), {
      email: 'member@usm.cl',
      nombre: 'Mem',
      apellido: 'Ber',
      createdAt: new Date(),
      isActive: true,
    })

    // Maestro creates a task assigned to the member, with importance 5.
    await signOut(auth)
    await signInWithEmailAndPassword(auth, maestroEmail, PW)
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Test task',
      descripcion: '',
      estado: 'pendiente',
      asignadoA: [memberUid],
      equipo: 'tecnico',
      prioridad: 'media',
      creadoPor: 'maestro',
      puntajeImportancia: 5,
      createdAt: Timestamp.now(),
    })

    // Member tries to self-award an inflated score → must be denied.
    await signOut(auth)
    await signInWithEmailAndPassword(auth, 'member@usm.cl', PW)
    await expectDenied(
      updateDoc(taskRef, {
        estado: 'completado',
        completedBy: memberUid,
        completedAt: new Date().toISOString(),
        scoreAwarded: 9999,
      })
    )

    // Setting scoreAwarded to the legitimate importance is allowed.
    await updateDoc(taskRef, {
      estado: 'completado',
      completedBy: memberUid,
      completedAt: new Date().toISOString(),
      scoreAwarded: 5,
    })
    const stored = await getDoc(taskRef)
    expect(stored.data()!.scoreAwarded).toBe(5)
  })

  it('blocks a non-manager from enqueuing /mail but allows a maestro', async () => {
    const maestroEmail = 'mailer@usm.cl'
    await bootstrapMaestro(maestroEmail)

    // Regular member cannot write to /mail.
    const { user: member } = await createUserWithEmailAndPassword(auth, 'm2@usm.cl', PW)
    await setDoc(doc(db, 'users', member.uid), {
      email: 'm2@usm.cl',
      nombre: 'M',
      apellido: 'Two',
      createdAt: new Date(),
      isActive: true,
    })
    await expectDenied(
      addDoc(collection(db, 'mail'), {
        to: 'victim@usm.cl',
        message: { subject: 'spam', html: 'x' },
        createdAt: Timestamp.now(),
      })
    )

    // Maestro can.
    await signOut(auth)
    await signInWithEmailAndPassword(auth, maestroEmail, PW)
    const ref = await addDoc(collection(db, 'mail'), {
      to: 'team@usm.cl',
      message: { subject: 'digest', html: 'x' },
      createdAt: Timestamp.now(),
    })
    expect(ref.id).toBeTruthy()
  })
})
