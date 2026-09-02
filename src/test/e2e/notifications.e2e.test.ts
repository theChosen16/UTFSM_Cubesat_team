import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  type DocumentReference,
} from 'firebase/firestore'
import { getTestFirebase, clearFirestoreData, clearAuthUsers, adminSetDoc, createVerifiedUser } from '../emulator-config'

describe('Notifications E2E', () => {
  const { auth, db } = getTestFirebase()
  const PW = 'Pass123!'
  let senderUid: string
  let recipientUid: string

  beforeAll(async () => {
    await clearFirestoreData()
    await clearAuthUsers()

    // Create sender. The 'system' notification type is now reserved for workspace managers
    // (anti-phishing hardening), so the sender is provisioned as maestro out-of-band — the
    // rules give no client path to a role — to exercise every notification type below.
    const { user: sender } = await createVerifiedUser(auth, 'sender@usm.cl', PW)
    senderUid = sender.uid
    await adminSetDoc(`users/${senderUid}`, {
      email: 'sender@usm.cl',
      nombre: 'Sender',
      apellido: 'User',
      rol: 'maestro',
      createdAt: new Date(),
      isActive: true,
    })

    await signOut(auth)

    // Create recipient
    const { user: recipient } = await createVerifiedUser(auth, 'recipient@usm.cl', PW)
    recipientUid = recipient.uid
    await setDoc(doc(db, 'users', recipientUid), {
      email: 'recipient@usm.cl',
      nombre: 'Recipient',
      apellido: 'User',
      createdAt: new Date(),
      isActive: true,
    })
  })

  // The notifications rules require the creator to be the sender (senderId == auth.uid)
  // and only the recipient may read/update their own notifications. Each test therefore
  // creates as the sender and reads back as the recipient.
  beforeEach(async () => {
    await signInWithEmailAndPassword(auth, 'sender@usm.cl', PW)
  })

  afterAll(async () => {
    await signOut(auth)
    await clearFirestoreData()
    await clearAuthUsers()
  })

  const asRecipient = () => signInWithEmailAndPassword(auth, 'recipient@usm.cl', PW)

  it('should send a message notification and store it in Firestore', async () => {
    const notifRef = await addDoc(collection(db, 'notifications'), {
      recipientId: recipientUid,
      type: 'message',
      title: 'Nuevo Mensaje',
      message: 'Hello from E2E test!',
      read: false,
      createdAt: Timestamp.now(),
      senderId: senderUid,
      senderName: 'Sender User',
    })

    await asRecipient()
    const stored = await getDoc(notifRef)
    expect(stored.exists()).toBe(true)

    const data = stored.data()!
    expect(data.type).toBe('message')
    expect(data.recipientId).toBe(recipientUid)
    expect(data.senderId).toBe(senderUid)
    expect(data.message).toBe('Hello from E2E test!')
    expect(data.read).toBe(false)
    expect(data.senderName).toBe('Sender User')
  })

  it('should mark a notification as read', async () => {
    const notifRef = await addDoc(collection(db, 'notifications'), {
      recipientId: recipientUid,
      type: 'system',
      title: 'System Notification',
      message: 'Test system notification',
      read: false,
      createdAt: Timestamp.now(),
      senderId: senderUid,
    })

    await asRecipient()
    expect((await getDoc(notifRef)).data()!.read).toBe(false)

    await updateDoc(notifRef, { read: true })

    const updated = await getDoc(notifRef)
    expect(updated.data()!.read).toBe(true)
  })

  it('should query notifications for a specific user', async () => {
    await addDoc(collection(db, 'notifications'), {
      recipientId: recipientUid,
      type: 'task_assigned',
      title: 'Tarea Asignada',
      message: 'You have been assigned a task',
      read: false,
      createdAt: Timestamp.now(),
      senderId: senderUid,
    })

    await asRecipient()
    const snapshot = await getDocs(
      query(collection(db, 'notifications'), where('recipientId', '==', recipientUid))
    )

    expect(snapshot.size).toBeGreaterThanOrEqual(1)
    snapshot.docs.forEach(d => {
      expect(d.data().recipientId).toBe(recipientUid)
    })
  })

  it('should support all notification types', async () => {
    const created: { type: string; ref: DocumentReference }[] = []
    for (const type of ['task_assigned', 'message', 'system'] as const) {
      const ref = await addDoc(collection(db, 'notifications'), {
        recipientId: recipientUid,
        type,
        title: `${type} notification`,
        message: `Testing ${type}`,
        read: false,
        createdAt: Timestamp.now(),
        senderId: senderUid,
      })
      created.push({ type, ref })
    }

    await asRecipient()
    for (const { type, ref } of created) {
      const stored = await getDoc(ref)
      expect(stored.data()!.type).toBe(type)
    }
  })

  it('should store task_assigned notification with relatedId', async () => {
    const taskId = 'fake-task-id-123'
    const ref = await addDoc(collection(db, 'notifications'), {
      recipientId: recipientUid,
      type: 'task_assigned',
      title: 'Tarea Asignada',
      message: 'New task assigned to you',
      read: false,
      createdAt: Timestamp.now(),
      senderId: senderUid,
      relatedId: taskId,
    })

    await asRecipient()
    const stored = await getDoc(ref)
    expect(stored.data()!.relatedId).toBe(taskId)
  })
})
