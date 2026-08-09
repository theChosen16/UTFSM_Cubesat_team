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

  it('blocks creating a profile under another member’s institutional email', async () => {
    const { user } = await createUserWithEmailAndPassword(auth, 'realone@usm.cl', PW)

    // Claiming somebody else's address would hijack their entry in the members directory and
    // redirect the weekly digest, so the stored email must match the verified token.
    await expectDenied(
      setDoc(doc(db, 'users', user.uid), {
        email: 'victim@usm.cl',
        nombre: 'Imp',
        apellido: 'Ostor',
        createdAt: new Date(),
        isActive: true,
      })
    )

    // The genuine address is accepted (case-insensitively).
    await setDoc(doc(db, 'users', user.uid), {
      email: 'RealOne@USM.cl',
      nombre: 'Real',
      apellido: 'One',
      createdAt: new Date(),
      isActive: true,
    })
    expect((await getDoc(doc(db, 'users', user.uid))).exists()).toBe(true)
  })

  it('lets a regular member read the team directory and update their own profile fields', async () => {
    const maestroUid = await bootstrapMaestro('dirboss@usm.cl')
    await signOut(auth)

    const { user: member } = await createUserWithEmailAndPassword(auth, 'member@sansano.usm.cl', PW)
    await setDoc(doc(db, 'users', member.uid), {
      email: 'member@sansano.usm.cl',
      nombre: 'Mem',
      apellido: 'Ber',
      createdAt: new Date(),
      isActive: true,
    })

    // The whole UI (team tree, member metrics, feed authorship) resolves names through the
    // users collection, so an ordinary member must be able to read other profiles.
    const other = await getDoc(doc(db, 'users', maestroUid))
    expect(other.exists()).toBe(true)

    // Profile fields the app actually writes are accepted…
    await updateDoc(doc(db, 'users', member.uid), {
      bio: 'Subsistema de potencia',
      title: 'Ingeniería EPS',
      socialLinks: { linkedin: 'https://linkedin.com/in/mem', github: '' },
      hasSeenOnboarding: true,
    })
    expect((await getDoc(doc(db, 'users', member.uid))).data()!.bio).toBe('Subsistema de potencia')

    // …but privileged fields are still not self-assignable. Note every one of these ADDS a key
    // the profile did not previously carry, which is exactly the case a `changedKeys()`-based
    // allowlist misses: the diff comes back empty and hasOnly() passes trivially. The rules use
    // affectedKeys() so the allowlist actually applies.
    await expectDenied(updateDoc(doc(db, 'users', member.uid), { rol: 'maestro' }))
    await expectDenied(updateDoc(doc(db, 'users', member.uid), { roles: ['maestro'] }))
    await expectDenied(updateDoc(doc(db, 'users', member.uid), { equipos: ['manager'] }))
    await expectDenied(updateDoc(doc(db, 'users', member.uid), { confirmadoCubeDesign: true }))
    await expectDenied(updateDoc(doc(db, 'users', member.uid), { email: 'someone@usm.cl' }))

    // A non-privileged team is still self-assignable (the feature this allowlist exists for).
    await updateDoc(doc(db, 'users', member.uid), { equipos: ['tecnico'] })
    expect((await getDoc(doc(db, 'users', member.uid))).data()!.equipos).toEqual(['tecnico'])

    // Oversized embedded media is rejected (avatars live inline in the user document).
    await expectDenied(updateDoc(doc(db, 'users', member.uid), { photoURL: 'x'.repeat(750001) }))
  })

  it('blocks an assignee from adding a field outside the task update allowlist', async () => {
    const maestroEmail = 'taskboss@usm.cl'
    const maestroUid = await bootstrapMaestro(maestroEmail)
    await signOut(auth)

    const { user: member } = await createUserWithEmailAndPassword(auth, 'assignee@usm.cl', PW)
    const memberUid = member.uid
    await setDoc(doc(db, 'users', memberUid), {
      email: 'assignee@usm.cl',
      nombre: 'Asig',
      apellido: 'Nado',
      createdAt: new Date(),
      isActive: true,
    })
    await signOut(auth)

    await signInWithEmailAndPassword(auth, maestroEmail, PW)
    const taskRef = await addDoc(collection(db, 'tasks'), {
      titulo: 'Integrar EPS',
      descripcion: 'Subsistema de potencia',
      estado: 'pendiente',
      asignadoA: [memberUid],
      equipo: 'tecnico',
      prioridad: 'media',
      creadoPor: maestroUid,
      puntajeImportancia: 5,
      createdAt: Timestamp.now(),
    })
    await signOut(auth)

    await signInWithEmailAndPassword(auth, 'assignee@usm.cl', PW)

    // The allowed field set still works for the assignee.
    await updateDoc(taskRef, { estado: 'en_progreso' })

    // Fields absent from the stored task cannot be smuggled in as *additions* — this is the
    // changedKeys()/affectedKeys() distinction again, applied to the task allowlist.
    await expectDenied(updateDoc(taskRef, { asignadoA: [memberUid, 'someone-else'] }))
    await expectDenied(updateDoc(taskRef, { fechaLimite: '2026-01-01' }))
    await expectDenied(updateDoc(taskRef, { titulo: 'Tarea secuestrada' }))
  })

  it('blocks re-attributing a post, comment or project message to another member', async () => {
    const { user: author } = await createUserWithEmailAndPassword(auth, 'poster@usm.cl', PW)
    const postRef = await addDoc(collection(db, 'posts'), {
      authorId: author.uid,
      content: 'mensaje original',
      likedBy: [],
      likesCount: 0,
      createdAt: Timestamp.now(),
    })
    const commentRef = await addDoc(collection(db, 'comments'), {
      postId: postRef.id,
      authorId: author.uid,
      content: 'comentario original',
      createdAt: Timestamp.now(),
    })
    const messageRef = await addDoc(collection(db, 'project_messages'), {
      projectId: 'proj-1',
      senderId: author.uid,
      content: 'mensaje de proyecto',
      createdAt: Timestamp.now(),
    })

    // Editing my own content is fine…
    await updateDoc(postRef, { content: 'mensaje editado' })
    await updateDoc(commentRef, { content: 'comentario editado' })
    await updateDoc(messageRef, { content: 'mensaje editado' })

    // …but authorship is immutable: an author cannot rewrite the byline so that arbitrary
    // content ends up attributed to a teammate.
    await expectDenied(updateDoc(postRef, { authorId: 'victim-uid' }))
    await expectDenied(updateDoc(commentRef, { authorId: 'victim-uid' }))
    await expectDenied(updateDoc(messageRef, { senderId: 'victim-uid' }))

    // Threading is pinned too, so content cannot be relocated under another post/project.
    await expectDenied(updateDoc(commentRef, { postId: 'another-post' }))
    await expectDenied(updateDoc(messageRef, { projectId: 'proj-2' }))
  })

  it('bounds the /mail queue to institutional recipients and sane payloads', async () => {
    const maestroEmail = 'mailboss@usm.cl'
    await bootstrapMaestro(maestroEmail)

    // The legitimate digest write is accepted.
    const ok = await addDoc(collection(db, 'mail'), {
      to: 'member@sansano.usm.cl',
      message: { subject: 'Boletín de la Órbita', html: '<p>hola</p>' },
      createdAt: Timestamp.now(),
    })
    expect(ok.id).toBeTruthy()

    // /mail is delivered by the team's authenticated sender, so it must not be usable to mail
    // arbitrary external addresses (phishing from a trusted identity).
    await expectDenied(
      addDoc(collection(db, 'mail'), {
        to: 'target@gmail.com',
        message: { subject: 'Verifica tu cuenta', html: '<a href="https://evil">clic</a>' },
        createdAt: Timestamp.now(),
      })
    )

    // Look-alike domains are rejected by the same anchored pattern used elsewhere.
    await expectDenied(
      addDoc(collection(db, 'mail'), {
        to: 'target@usm.cl.evil.com',
        message: { subject: 'Hola', html: '<p>hola</p>' },
        createdAt: Timestamp.now(),
      })
    )

    // Oversized bodies cannot be parked in the queue.
    await expectDenied(
      addDoc(collection(db, 'mail'), {
        to: 'member@usm.cl',
        message: { subject: 'Hola', html: 'x'.repeat(200001) },
        createdAt: Timestamp.now(),
      })
    )
  })

  it('blocks re-addressing a notification to another member', async () => {
    const { user: sender } = await createUserWithEmailAndPassword(auth, 'notif-a@usm.cl', PW)
    await signOut(auth)

    const { user: recipient } = await createUserWithEmailAndPassword(auth, 'notif-b@usm.cl', PW)
    const notifRef = await addDoc(collection(db, 'notifications'), {
      senderId: recipient.uid,
      recipientId: recipient.uid,
      type: 'message',
      title: 'Hola',
      message: 'Saludo',
      read: false,
      createdAt: Timestamp.now(),
    })

    // Marking my own notification as read is fine.
    await updateDoc(notifRef, { read: true })

    // Re-pointing it at somebody else (turning it into a message they never received) is not.
    await expectDenied(updateDoc(notifRef, { recipientId: 'victim-uid' }))
    await expectDenied(updateDoc(notifRef, { senderId: sender.uid }))
  })
})
