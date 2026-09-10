import { initializeApp, getApps, deleteApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  type Auth,
  type UserCredential,
} from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore'

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

/**
 * Marks an account's email as verified through the Auth emulator's privileged REST endpoint —
 * the emulator stand-in for the user clicking the link in their mailbox.
 */
export async function markEmailVerified(uid: string) {
  // The emulator's privileged (Bearer owner) account-update endpoint is NOT project-scoped;
  // the /projects/{id}/ form answers USER_NOT_FOUND for accounts created through the client SDK.
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer owner',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: uid, emailVerified: true }),
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to verify ${uid}: ${response.status} ${await response.text()}`)
  }
}

/**
 * Registers a member the way the real flow ends up: account created, verification link followed.
 *
 * `isInstitutional()` in the rules requires `email_verified` — an @usm.cl address alone was never
 * proof of membership, since Firebase's email/password sign-up never checks that anyone can
 * receive mail there. Fixtures therefore have to mint VERIFIED sessions to represent a real
 * member, and the token has to be re-minted after flipping the flag: the rules read the claim off
 * the ID token, and the cached one still says false.
 */
export async function createVerifiedUser(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await markEmailVerified(credential.user.uid)
  await credential.user.reload()
  await credential.user.getIdToken(true)
  return credential
}

/**
 * Registers an account WITHOUT following the verification link — i.e. exactly what an outsider
 * gets by typing a plausible @usm.cl address into the sign-up form. Named explicitly so a test
 * that relies on the unverified state says so.
 */
export function createUnverifiedUser(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password)
}

/** Encodes a plain JS value into the Firestore REST `Value` representation. */
function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } }
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } }
  }
  return { stringValue: String(value) }
}

function toFirestoreFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value)
  }
  return fields
}

/**
 * Writes a document straight through the emulator's REST API with the `owner` bearer token,
 * which bypasses the security rules exactly like an Admin SDK / Firebase console write.
 *
 * This is how privileged fixtures must be seeded now: the rules deliberately give **no** client
 * path to create a document carrying `rol: 'maestro'` (the old `_bootstrap_lock` self-claim was
 * a privilege-escalation hole — see SECURITY.md), so a test that provisions a maestro has to do
 * it out-of-band, the same way a real operator does.
 */
export async function adminSetDoc(path: string, data: Record<string, unknown>) {
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer owner',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to seed ${path}: ${response.status} ${await response.text()}`)
  }
}

/**
 * Seeds a maestro user out-of-band (see `adminSetDoc`). Registration never grants a role, so
 * the first maestro of a real workspace is provisioned from the Firebase console; tests mirror
 * that instead of pretending a client can elevate itself.
 *
 * `db` is kept in the signature so call sites read the same as before.
 */
export async function bootstrapMaestro(
  _db: Firestore,
  uid: string,
  email: string,
  extra: Record<string, unknown> = {}
) {
  await adminSetDoc(`users/${uid}`, {
    email,
    nombre: 'Maestro',
    apellido: 'User',
    rol: 'maestro',
    createdAt: new Date(),
    isActive: true,
    ...extra,
  })
}
