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

  it('blocks a regular member from forging a system notification but allows a manager', async () => {
    const maestroEmail = 'sysboss@usm.cl'
    await bootstrapMaestro(maestroEmail)
    await signOut(auth)

    // Regular member cannot emit an official-looking 'system' alert (in-app phishing).
    const { user: member } = await createUserWithEmailAndPassword(auth, 'sysmem@usm.cl', PW)
    await setDoc(doc(db, 'users', member.uid), {
      email: 'sysmem@usm.cl',
      nombre: 'Sys',
      apellido: 'Mem',
      createdAt: new Date(),
      isActive: true,
    })
    await expectDenied(
      addDoc(collection(db, 'notifications'), {
        senderId: member.uid,
        recipientId: 'victim',
        type: 'system',
        title: 'Alerta oficial',
        message: 'Haz clic aquí',
        read: false,
        createdAt: Timestamp.now(),
      })
    )

    // A maestro (workspace manager) can legitimately emit a 'system' notification.
    await signOut(auth)
    await signInWithEmailAndPassword(auth, maestroEmail, PW)
    const ref = await addDoc(collection(db, 'notifications'), {
      senderId: (auth.currentUser as { uid: string }).uid,
      recipientId: 'team',
      type: 'system',
      title: 'Mantención',
      message: 'El portal estará en mantención el viernes.',
      read: false,
      createdAt: Timestamp.now(),
    })
    expect(ref.id).toBeTruthy()
  })

  it('blocks a non-institutional authenticated user from reading the private workspace', async () => {
    // Seed some workspace data as a legitimate maestro.
    await bootstrapMaestro('wsboss@usm.cl')
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Secreto interno',
      descripcion: '',
      estado: 'pendiente',
      asignadoA: [],
      equipo: 'tecnico',
      prioridad: 'media',
      creadoPor: 'maestro',
      puntajeImportancia: 5,
      createdAt: Timestamp.now(),
    })
    const projectRef = await addDoc(collection(db, 'projects'), {
      nombre: 'Proyecto privado',
      descripcion: '',
      estado: 'activo',
      createdAt: Timestamp.now(),
    })
    await signOut(auth)

    // An outsider registers a NON-institutional account (bypassing the client-side domain
    // check by talking to Auth directly). The server-side rules must deny workspace reads.
    await createUserWithEmailAndPassword(auth, 'outsider@gmail.com', PW)
    await expectDenied(getDoc(taskRef))
    await expectDenied(getDoc(projectRef))
    await signOut(auth)

    // A genuine institutional member can still read the same documents.
    await createUserWithEmailAndPassword(auth, 'insider@usm.cl', PW)
    const taskSnap = await getDoc(taskRef)
    expect(taskSnap.data()!.titulo).toBe('Secreto interno')
  })

  it('blocks a non-institutional user from reading system_config secrets', async () => {
    await bootstrapMaestro('cfgboss2@usm.cl')
    await setDoc(doc(db, 'system_config', 'keys'), {
      driveUploadUrl: 'https://example/exec',
      driveUploadSecret: 'top-secret-2',
    })
    await signOut(auth)

    await createUserWithEmailAndPassword(auth, 'evil@gmail.com', PW)
    await expectDenied(getDoc(doc(db, 'system_config', 'keys')))
  })

  it('allows a legitimate activity_log entry but blocks a forged type (audit-log integrity)', async () => {
    const { user } = await createUserWithEmailAndPassword(auth, 'logger@usm.cl', PW)

    // A genuine entry with a known ActivityLogType for the caller's own uid is accepted.
    const ok = await addDoc(collection(db, 'activity_log'), {
      userId: user.uid,
      type: 'task_completed',
      relatedId: 'task-123',
      description: 'Completó la tarea de telemetría',
      createdAt: Timestamp.now(),
    })
    expect(ok.id).toBeTruthy()

    // A forged type outside the ActivityLogType allowlist is rejected — a member cannot
    // fabricate arbitrary audit-trail events for themselves.
    await expectDenied(
      addDoc(collection(db, 'activity_log'), {
        userId: user.uid,
        type: 'arbitrary_spoof',
        relatedId: 'task-123',
        description: 'Evento de auditoría falso',
        createdAt: Timestamp.now(),
      })
    )
  })

  it('blocks writing an activity_log entry attributed to another user', async () => {
    const { user } = await createUserWithEmailAndPassword(auth, 'logger2@usm.cl', PW)

    // userId must equal the caller's uid: a member cannot forge audit entries in
    // someone else's name.
    await expectDenied(
      addDoc(collection(db, 'activity_log'), {
        userId: 'someone-else-uid',
        type: 'task_completed',
        relatedId: 'task-9',
        description: 'Actividad atribuida a un tercero',
        createdAt: Timestamp.now(),
      })
    )
    expect(user.uid).toBeTruthy()
  })

  it('rejects an over-cap description on an activity_log entry (storage/egress abuse)', async () => {
    const { user } = await createUserWithEmailAndPassword(auth, 'logger3@usm.cl', PW)

    await expectDenied(
      addDoc(collection(db, 'activity_log'), {
        userId: user.uid,
        type: 'task_progress_logged',
        relatedId: 'task-1',
        description: 'x'.repeat(2001),
        createdAt: Timestamp.now(),
      })
    )
  })

  it('requires the uploader to be the caller and bounds file metadata size', async () => {
    const { user } = await createUserWithEmailAndPassword(auth, 'uploader@usm.cl', PW)

    // A legitimate, correctly-sized file metadata record for the caller is accepted.
    const ok = await addDoc(collection(db, 'files'), {
      name: 'informe.pdf',
      driveFileId: 'drive-abc',
      viewURL: 'https://drive.google.com/file/d/drive-abc/view',
      downloadURL: 'https://drive.google.com/uc?export=download&id=drive-abc',
      mimeType: 'application/pdf',
      size: 1234,
      uploadedBy: user.uid,
      createdAt: Timestamp.now(),
    })
    expect(ok.id).toBeTruthy()

    // A member cannot forge a record attributed to another uploader.
    await expectDenied(
      addDoc(collection(db, 'files'), {
        name: 'spoof.pdf',
        uploadedBy: 'another-uid',
        createdAt: Timestamp.now(),
      })
    )

    // Oversized metadata (e.g. a multi-MB base64 blob smuggled into a URL field) is rejected.
    await expectDenied(
      addDoc(collection(db, 'files'), {
        name: 'huge.pdf',
        viewURL: 'https://x/' + 'a'.repeat(3000),
        uploadedBy: user.uid,
        createdAt: Timestamp.now(),
      })
    )
  })

  /**
   * Creates a maestro, then an 'admin' user promoted by that maestro, and leaves the session
   * signed in AS THE ADMIN. Returns both uids.
   */
  async function bootstrapAdmin(adminEmail: string): Promise<{ maestroUid: string; adminUid: string }> {
    // Derive the maestro address from the admin one so repeated calls never collide in the
    // shared Auth emulator.
    const maestroEmail = `root-${adminEmail.split('@')[0]}@usm.cl`
    const maestroUid = await bootstrapMaestro(maestroEmail)
    await signOut(auth)

    const { user: adminUser } = await createUserWithEmailAndPassword(auth, adminEmail, PW)
    const adminUid = adminUser.uid
    await setDoc(doc(db, 'users', adminUid), {
      email: adminEmail,
      nombre: 'Ada',
      apellido: 'Admin',
      createdAt: new Date(),
      isActive: true,
    })
    await signOut(auth)

    // The maestro promotes them to admin (the only path the rules allow).
    await signInWithEmailAndPassword(auth, maestroEmail, PW)
    await updateDoc(doc(db, 'users', adminUid), { rol: 'admin' })
    await signOut(auth)

    await signInWithEmailAndPassword(auth, adminEmail, PW)
    return { maestroUid, adminUid }
  }

  it('blocks a regular member from ADDING a rol field to their own document', async () => {
    // Regression test for the changedKeys()/affectedKeys() confusion in the self-update
    // allowlist. `changedKeys()` only reports keys present in BOTH the before and after maps,
    // so a write that *added* an absent field was invisible to it. A normal account carries no
    // 'rol' field at all, so `changedKeys().hasOnly(allowedFields)` was trivially satisfied and
    // any member could grant themselves rol:'admin' on their own document — and from there
    // (under the old blanket admin rule) rol:'maestro'. The allowlist now uses affectedKeys().
    await bootstrapMaestro('boss14@usm.cl')
    await signOut(auth)

    const { user } = await createUserWithEmailAndPassword(auth, 'climber@usm.cl', PW)
    await setDoc(doc(db, 'users', user.uid), {
      email: 'climber@usm.cl',
      nombre: 'Cli',
      apellido: 'Mber',
      createdAt: new Date(),
      isActive: true,
    })

    await expectDenied(updateDoc(doc(db, 'users', user.uid), { rol: 'admin' }))
    await expectDenied(updateDoc(doc(db, 'users', user.uid), { rol: 'maestro' }))
    await expectDenied(updateDoc(doc(db, 'users', user.uid), { roles: ['maestro'] }))
    await expectDenied(updateDoc(doc(db, 'users', user.uid), { equipos: ['manager'] }))
    await expectDenied(updateDoc(doc(db, 'users', user.uid), { isActive: false }))

    // A legitimate, allowlisted self-edit still works.
    await updateDoc(doc(db, 'users', user.uid), { nombre: 'Climber' })

    const snap = await getDoc(doc(db, 'users', user.uid))
    expect(snap.data()!.rol).toBeUndefined()
    expect(snap.data()!.nombre).toBe('Climber')
  })

  it('blocks an assigned member from ADDING a field outside the task allowlist', async () => {
    // Same affectedKeys() class of bug on the task update rule: an assignee could previously
    // add any field the task document did not already carry.
    const maestroEmail = 'boss15@usm.cl'
    await bootstrapMaestro(maestroEmail)

    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Validar arnés',
      descripcion: '',
      estado: 'pendiente',
      asignadoA: ['assignee-placeholder'],
      equipo: 'tecnico',
      prioridad: 'media',
      createdAt: Timestamp.now(),
    })
    await signOut(auth)

    const { user: assignee } = await createUserWithEmailAndPassword(auth, 'assignee9@usm.cl', PW)
    await setDoc(doc(db, 'users', assignee.uid), {
      email: 'assignee9@usm.cl',
      nombre: 'As',
      apellido: 'Signee',
      createdAt: new Date(),
      isActive: true,
    })
    await signOut(auth)

    await signInWithEmailAndPassword(auth, maestroEmail, PW)
    await updateDoc(doc(db, 'tasks', taskRef.id), { asignadoA: [assignee.uid] })
    await signOut(auth)

    await signInWithEmailAndPassword(auth, 'assignee9@usm.cl', PW)

    // 'puntajeImportancia' is absent from this task, so adding it used to slip past the
    // allowlist — and it is the very value the anti-fraud score check compares against.
    await expectDenied(updateDoc(doc(db, 'tasks', taskRef.id), { puntajeImportancia: 999 }))
    await expectDenied(updateDoc(doc(db, 'tasks', taskRef.id), { equipo: 'manager' }))

    // An allowlisted field update still works.
    await updateDoc(doc(db, 'tasks', taskRef.id), { estado: 'en_progreso' })
  })

  it('blocks an admin from escalating themselves to maestro', async () => {
    const { adminUid } = await bootstrapAdmin('ada@usm.cl')

    // The core escalation: the previous rule granted admins a blanket update on any user doc.
    await expectDenied(updateDoc(doc(db, 'users', adminUid), { rol: 'maestro' }))
    await expectDenied(updateDoc(doc(db, 'users', adminUid), { roles: ['maestro'] }))

    const snap = await getDoc(doc(db, 'users', adminUid))
    expect(snap.data()!.rol).toBe('admin')
  })

  it('blocks an admin from tampering with the maestro account', async () => {
    const { maestroUid } = await bootstrapAdmin('ada2@usm.cl')

    // Neither demoting nor locking out the maestro is available to an admin.
    await expectDenied(updateDoc(doc(db, 'users', maestroUid), { rol: null }))
    await expectDenied(updateDoc(doc(db, 'users', maestroUid), { isActive: false }))
  })

  it('still lets an admin manage a regular member (non-role fields)', async () => {
    await bootstrapAdmin('ada3@usm.cl')
    await signOut(auth)

    const { user: member } = await createUserWithEmailAndPassword(auth, 'member9@usm.cl', PW)
    await setDoc(doc(db, 'users', member.uid), {
      email: 'member9@usm.cl',
      nombre: 'Reg',
      apellido: 'User',
      createdAt: new Date(),
      isActive: true,
    })
    await signOut(auth)

    await signInWithEmailAndPassword(auth, 'ada3@usm.cl', PW)
    await updateDoc(doc(db, 'users', member.uid), { equipos: ['tecnico'], isActive: false })

    const snap = await getDoc(doc(db, 'users', member.uid))
    expect(snap.data()!.equipos).toEqual(['tecnico'])

    // ...but still cannot hand that member a role.
    await expectDenied(updateDoc(doc(db, 'users', member.uid), { rol: 'admin' }))
  })

  it('lets a member save their own profile fields (bio, links, portfolio, onboarding)', async () => {
    await bootstrapMaestro('boss10@usm.cl')
    await signOut(auth)

    const { user } = await createUserWithEmailAndPassword(auth, 'profiler@usm.cl', PW)
    await setDoc(doc(db, 'users', user.uid), {
      email: 'profiler@usm.cl',
      nombre: 'Pro',
      apellido: 'Filer',
      createdAt: new Date(),
      isActive: true,
    })

    // These are exactly the fields Profile.tsx / OnboardingGuide.tsx persist. Before this fix
    // they were absent from the self-update allowlist, so every profile save was denied.
    await updateDoc(doc(db, 'users', user.uid), {
      bio: 'Ingeniero de subsistema de potencia.',
      title: 'Líder EPS',
      socialLinks: { linkedin: 'https://linkedin.com/in/pro', github: 'https://github.com/pro' },
      portfolioImages: ['data:image/jpeg;base64,AAAA'],
      fechaCumpleanos: '11-14',
      hasSeenOnboarding: true,
    })

    const snap = await getDoc(doc(db, 'users', user.uid))
    expect(snap.data()!.title).toBe('Líder EPS')
    expect(snap.data()!.hasSeenOnboarding).toBe(true)
  })

  it('bounds the self-editable profile fields against storage abuse', async () => {
    await bootstrapMaestro('boss11@usm.cl')
    await signOut(auth)

    const { user } = await createUserWithEmailAndPassword(auth, 'bloater@usm.cl', PW)
    await setDoc(doc(db, 'users', user.uid), {
      email: 'bloater@usm.cl',
      nombre: 'B',
      apellido: 'Loater',
      createdAt: new Date(),
      isActive: true,
    })

    await expectDenied(updateDoc(doc(db, 'users', user.uid), { bio: 'x'.repeat(2001) }))
    await expectDenied(
      updateDoc(doc(db, 'users', user.uid), {
        portfolioImages: Array.from({ length: 9 }, () => 'data:image/jpeg;base64,AAAA'),
      })
    )
    // Privileged fields stay outside the allowlist.
    await expectDenied(updateDoc(doc(db, 'users', user.uid), { rol: 'admin' }))
    await expectDenied(updateDoc(doc(db, 'users', user.uid), { isActive: false }))
  })

  it('blocks re-attributing an own post to another member', async () => {
    await bootstrapMaestro('boss12@usm.cl')
    await signOut(auth)

    const { user } = await createUserWithEmailAndPassword(auth, 'poster@usm.cl', PW)
    const post = await addDoc(collection(db, 'posts'), {
      authorId: user.uid,
      content: 'Avance del subsistema estructural.',
      likedBy: [],
      likesCount: 0,
      createdAt: Timestamp.now(),
    })

    // Editing own content stays allowed...
    await updateDoc(doc(db, 'posts', post.id), { content: 'Avance corregido.' })

    // ...but the authorship cannot be moved onto a colleague.
    await expectDenied(updateDoc(doc(db, 'posts', post.id), { authorId: 'victim-uid' }))
  })

  it('restricts mail_digests reads (recipient roster) to workspace managers', async () => {
    const maestroUid = await bootstrapMaestro('boss13@usm.cl')

    const digest = await addDoc(collection(db, 'mail_digests'), {
      triggeredBy: maestroUid,
      recipientCount: 2,
      eventsCount: 0,
      tasksCount: 0,
      recipients: ['a@usm.cl', 'b@usm.cl'],
      createdAt: Timestamp.now(),
    })

    // The maestro (a workspace manager) can read it.
    const asMaestro = await getDoc(doc(db, 'mail_digests', digest.id))
    expect(asMaestro.data()!.recipientCount).toBe(2)

    await signOut(auth)
    const { user } = await createUserWithEmailAndPassword(auth, 'nosy@usm.cl', PW)
    await setDoc(doc(db, 'users', user.uid), {
      email: 'nosy@usm.cl',
      nombre: 'No',
      apellido: 'Sy',
      createdAt: new Date(),
      isActive: true,
    })

    // A regular member can no longer enumerate every member's email address.
    await expectDenied(getDoc(doc(db, 'mail_digests', digest.id)))
  })
})
