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

  // The emulator reports write denials as 'permission-denied' but read (get) denials can
  // surface as the verbose rule-evaluation reason ("false for 'get' @ L..."), so the matcher
  // accepts both phrasings.
  const expectDenied = (p: Promise<unknown>) =>
    expect(p).rejects.toThrow(/permission|insufficient|denied|false for/i)

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

  it('blocks an assigned member from self-scoring a legacy task lacking puntajeImportancia', async () => {
    const maestroEmail = 'legacyboss@usm.cl'
    await bootstrapMaestro(maestroEmail)

    const { user: member } = await createUserWithEmailAndPassword(auth, 'legacymem@usm.cl', PW)
    const memberUid = member.uid
    await setDoc(doc(db, 'users', memberUid), {
      email: 'legacymem@usm.cl',
      nombre: 'Leg',
      apellido: 'Acy',
      createdAt: new Date(),
      isActive: true,
    })

    // Maestro creates a LEGACY-shaped task assigned to the member WITHOUT puntajeImportancia.
    await signOut(auth)
    await signInWithEmailAndPassword(auth, maestroEmail, PW)
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Legacy task',
      descripcion: '',
      estado: 'pendiente',
      asignadoA: [memberUid],
      equipo: 'tecnico',
      prioridad: 'media',
      creadoPor: 'maestro',
      createdAt: Timestamp.now(),
    })

    // Member tries to self-award any positive score on a task with no manager-set importance.
    await signOut(auth)
    await signInWithEmailAndPassword(auth, 'legacymem@usm.cl', PW)
    await expectDenied(
      updateDoc(taskRef, {
        estado: 'completado',
        completedBy: memberUid,
        completedAt: new Date().toISOString(),
        scoreAwarded: 50,
      })
    )

    // Completing with scoreAwarded 0 (the only consistent value for a no-importance task) is ok.
    await updateDoc(taskRef, {
      estado: 'completado',
      completedBy: memberUid,
      completedAt: new Date().toISOString(),
      scoreAwarded: 0,
    })
    const stored = await getDoc(taskRef)
    expect(stored.data()!.scoreAwarded).toBe(0)
  })

  it('blocks an assigned member from crediting task completion to a third party', async () => {
    const maestroEmail = 'creditboss@usm.cl'
    await bootstrapMaestro(maestroEmail)

    const { user: member } = await createUserWithEmailAndPassword(auth, 'creditmem@usm.cl', PW)
    const memberUid = member.uid
    await setDoc(doc(db, 'users', memberUid), {
      email: 'creditmem@usm.cl',
      nombre: 'Cre',
      apellido: 'Dit',
      createdAt: new Date(),
      isActive: true,
    })

    await signOut(auth)
    await signInWithEmailAndPassword(auth, maestroEmail, PW)
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Credit task',
      descripcion: '',
      estado: 'pendiente',
      asignadoA: [memberUid],
      equipo: 'tecnico',
      prioridad: 'media',
      creadoPor: 'maestro',
      puntajeImportancia: 5,
      createdAt: Timestamp.now(),
    })

    // Member completes the task but tries to attribute the credit/score to someone else.
    await signOut(auth)
    await signInWithEmailAndPassword(auth, 'creditmem@usm.cl', PW)
    await expectDenied(
      updateDoc(taskRef, {
        estado: 'completado',
        completedBy: 'another-member-uid',
        completedAt: new Date().toISOString(),
        scoreAwarded: 5,
      })
    )

    // Crediting themselves (the real assignee) is allowed.
    await updateDoc(taskRef, {
      estado: 'completado',
      completedBy: memberUid,
      completedAt: new Date().toISOString(),
      scoreAwarded: 5,
    })
    const stored = await getDoc(taskRef)
    expect(stored.data()!.completedBy).toBe(memberUid)
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

  it('blocks reading system_config from a look-alike spoofed domain but allows real usm.cl', async () => {
    // A maestro seeds the secret-bearing system_config/keys document.
    const maestroEmail = 'cfgboss@usm.cl'
    await bootstrapMaestro(maestroEmail)
    await setDoc(doc(db, 'system_config', 'keys'), {
      driveUploadUrl: 'https://example/exec',
      driveUploadSecret: 'top-secret',
    })
    await signOut(auth)

    // Attacker registers a domain they control that *contains* usm.cl as a substring.
    // With an unanchored regex this leaked the Drive secret; anchoring must deny it.
    const { user: attacker } = await createUserWithEmailAndPassword(auth, 'eve@usm.cl.evil.com', PW)
    expect(attacker).toBeTruthy()
    await expectDenied(getDoc(doc(db, 'system_config', 'keys')))
    await signOut(auth)

    // A genuine institutional account is still allowed to read it.
    await createUserWithEmailAndPassword(auth, 'real@usm.cl', PW)
    const snap = await getDoc(doc(db, 'system_config', 'keys'))
    expect(snap.data()!.driveUploadSecret).toBe('top-secret')
  })

  it('blocks a non-institutional (non-@usm.cl) account from reading the private workspace', async () => {
    // A maestro seeds real workspace data.
    const maestroEmail = 'gatekeeper@usm.cl'
    const maestroUid = await bootstrapMaestro(maestroEmail)
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Confidential mission task',
      descripcion: 'internal',
      estado: 'pendiente',
      asignadoA: [],
      equipo: 'tecnico',
      prioridad: 'media',
      creadoPor: maestroUid,
      puntajeImportancia: 5,
      createdAt: Timestamp.now(),
    })
    await addDoc(collection(db, 'posts'), {
      authorId: maestroUid,
      content: 'internal announcement',
      likedBy: [],
      likesCount: 0,
      createdAt: Timestamp.now(),
    })
    await signOut(auth)

    // An outsider registers with a non-institutional email. Firebase Auth accepts any domain,
    // so the domain restriction MUST be enforced by the security rules, not just the UI.
    const { user: outsider } = await createUserWithEmailAndPassword(auth, 'intruder@gmail.com', PW)
    expect(outsider).toBeTruthy()

    // Every private collection read must be denied for the outsider.
    await expectDenied(getDoc(taskRef))
    await expectDenied(getDoc(doc(db, 'users', maestroUid)))
    await expectDenied(getDoc(doc(db, 'system_config', 'keys')))

    // And they cannot bootstrap a profile document either (create is gated too).
    await expectDenied(
      setDoc(doc(db, 'users', outsider.uid), {
        email: 'intruder@gmail.com',
        nombre: 'In',
        apellido: 'Truder',
        createdAt: new Date(),
        isActive: true,
      })
    )
    await signOut(auth)

    // A genuine institutional member CAN read the same task (control case).
    await createUserWithEmailAndPassword(auth, 'insider@sansano.usm.cl', PW)
    const snap = await getDoc(taskRef)
    expect(snap.data()!.titulo).toBe('Confidential mission task')
  })

  it('lets a user toggle their own like but blocks tampering with arbitrary like counts', async () => {
    const { user: author } = await createUserWithEmailAndPassword(auth, 'author@usm.cl', PW)
    const postRef = await addDoc(collection(db, 'posts'), {
      authorId: author.uid,
      content: 'hola equipo',
      likedBy: [],
      likesCount: 0,
      createdAt: Timestamp.now(),
    })
    await signOut(auth)

    const { user: liker } = await createUserWithEmailAndPassword(auth, 'liker@usm.cl', PW)

    // Legit: adding only my own uid, with a consistent count.
    await updateDoc(postRef, { likedBy: [liker.uid], likesCount: 1 })
    const afterLike = await getDoc(postRef)
    expect(afterLike.data()!.likesCount).toBe(1)

    // Tampering: inflate the count beyond the array length → denied.
    await expectDenied(updateDoc(postRef, { likedBy: [liker.uid], likesCount: 9999 }))

    // Tampering: inject a uid that is not mine → denied.
    await expectDenied(updateDoc(postRef, { likedBy: [liker.uid, 'someone-else'], likesCount: 2 }))
  })

  it('blocks creating a notification with an out-of-allowlist type', async () => {
    const { user: sender } = await createUserWithEmailAndPassword(auth, 'notifier@usm.cl', PW)

    // Valid type is accepted.
    const ok = await addDoc(collection(db, 'notifications'), {
      senderId: sender.uid,
      recipientId: 'someone',
      type: 'message',
      title: 'Hola',
      message: 'Saludo',
      read: false,
      createdAt: Timestamp.now(),
    })
    expect(ok.id).toBeTruthy()

    // Forged/unknown type is rejected.
    await expectDenied(
      addDoc(collection(db, 'notifications'), {
        senderId: sender.uid,
        recipientId: 'someone',
        type: 'arbitrary_spoof',
        title: 'Hola',
        message: 'Saludo',
        read: false,
        createdAt: Timestamp.now(),
      })
    )
  })
})
