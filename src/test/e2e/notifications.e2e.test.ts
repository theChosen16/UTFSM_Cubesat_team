import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
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
} from 'firebase/firestore'
import { getTestFirebase, clearFirestoreData, clearAuthUsers } from '../emulator-config'

describe('Notifications E2E', () => {
  const { auth, db } = getTestFirebase()
  let senderUid: string
  let recipientUid: string

  beforeAll(async () => {
    await clearFirestoreData()
    await clearAuthUsers()

    // Create sender
    const { user: sender } = await createUserWithEmailAndPassword(auth, 'sender@usm.cl', 'Pass123!')
    senderUid = sender.uid
    await setDoc(doc(db, 'users', senderUid), {
      email: 'sender@usm.cl',
      nombre: 'Sender',
      apellido: 'User',
      createdAt: new Date(),
      isActive: true,
    })

    await signOut(auth)

    // Create recipient
    const { user: recipient } = await createUserWithEmailAndPassword(auth, 'recipient@usm.cl', 'Pass123!')
    recipientUid = recipient.uid
    await setDoc(doc(db, 'users', recipientUid), {
      email: 'recipient@usm.cl',
      nombre: 'Recipient',
      apellido: 'User',
      createdAt: new Date(),
      isActive: true,
    })
  })

  afterAll(async () => {
    await signOut(auth)
    await clearFirestoreData()
    await clearAuthUsers()
  })

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
    })

    expect((await getDoc(notifRef)).data()!.read).toBe(false)

    await updateDoc(notifRef, { read: true })

    const updated = await getDoc(notifRef)
    expect(updated.data()!.read).toBe(true)
  })

  it('should query notifications for a specific user', async () => {
    // Add notifications for recipient
    await addDoc(collection(db, 'notifications'), {
      recipientId: recipientUid,
      type: 'task_assigned',
      title: 'Tarea Asignada',
      message: 'You have been assigned a task',
      read: false,
      createdAt: Timestamp.now(),
    })

    const snapshot = await getDocs(
      query(collection(db, 'notifications'), where('recipientId', '==', recipientUid))
    )

    expect(snapshot.size).toBeGreaterThanOrEqual(1)
    snapshot.docs.forEach(d => {
      expect(d.data().recipientId).toBe(recipientUid)
    })
  })

  it('should support all notification types', async () => {
    for (const type of ['task_assigned', 'message', 'system'] as const) {
      const ref = await addDoc(collection(db, 'notifications'), {
        recipientId: recipientUid,
        type,
        title: `${type} notification`,
        message: `Testing ${type}`,
        read: false,
        createdAt: Timestamp.now(),
      })

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
      relatedId: taskId,
    })

    const stored = await getDoc(ref)
    expect(stored.data()!.relatedId).toBe(taskId)
  })
})
