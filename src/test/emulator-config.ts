import { initializeApp, getApps, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

const TEST_PROJECT_ID = 'cubesat-test'

let initialized = false

export function getTestFirebase() {
  if (!initialized) {
    // Clear any existing apps
    getApps().forEach(app => deleteApp(app))

    const app = initializeApp({
      projectId: TEST_PROJECT_ID,
      apiKey: 'test-api-key',
      authDomain: `${TEST_PROJECT_ID}.firebaseapp.com`,
    })

    const auth = getAuth(app)
    const db = getFirestore(app)

    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)

    initialized = true
    return { app, auth, db }
  }

  const app = getApps()[0]
  return { app, auth: getAuth(app), db: getFirestore(app) }
}

export async function clearFirestoreData() {
  const response = await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  )
  if (!response.ok) {
    throw new Error(`Failed to clear Firestore: ${response.statusText}`)
  }
}

export async function clearAuthUsers() {
  const response = await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${TEST_PROJECT_ID}/accounts`,
    { method: 'DELETE' }
  )
  if (!response.ok) {
    throw new Error(`Failed to clear Auth users: ${response.statusText}`)
  }
}
