import { initializeApp, getApps, deleteApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  applyActionCode,
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

interface EmulatorOobCode {
  email: string
  requestType: string
  oobCode: string
}

/**
 * Verifies an Auth-emulator account by actually consuming the verification link, the same way
 * a real member does: `sendEmailVerification` mints an out-of-band code, the emulator exposes
 * the "mailbox" over `/emulator/v1/projects/{p}/oobCodes`, and `applyActionCode` redeems it.
 *
 * The workspace boundary in `firestore.rules` requires a VERIFIED institutional address, so a
 * fixture that only calls `createUserWithEmailAndPassword` is — correctly — not a member.
 */
export async function verifyEmailViaOobCode(auth: Auth, email: string) {
  const user = auth.currentUser
  if (!user) throw new Error('verifyEmailViaOobCode requires a signed-in user')

  await sendEmailVerification(user)

  // The Auth emulator files out-of-band codes under the project it was STARTED with. With
  // `singleProjectMode` on (the default) that is the CLI's project — `demo-no-project` when
  // `firebase emulators:exec` runs without one — even though the SDK connects as
  // TEST_PROJECT_ID, so both have to be probed for the helper to work either way.
  const candidates = [TEST_PROJECT_ID, 'demo-no-project']
  let match: EmulatorOobCode | undefined
  for (const project of candidates) {
    const response = await fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${project}/oobCodes`
    )
    if (!response.ok) continue
    const body = (await response.json()) as { oobCodes?: EmulatorOobCode[] }
    match = [...(body.oobCodes ?? [])]
      .reverse()
      .find(code => code.email === email && code.requestType === 'VERIFY_EMAIL')
    if (match) break
  }
  if (!match) {
    throw new Error(`No VERIFY_EMAIL code issued for ${email}`)
  }

  await applyActionCode(auth, match.oobCode)
  await user.reload()
  // `email_verified` is a claim baked into the ID token at issue time and is what the rules
  // read, so the token has to be reminted before the account counts as a member.
  await user.getIdToken(true)
}

/**
 * Registers a member the way the product does end to end: create the account, verify the
 * address, then refresh the ID token.
 *
 * Returns the same `UserCredential` as `createUserWithEmailAndPassword`, so it is a drop-in
 * replacement at the call sites.
 */
export async function createVerifiedUser(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await verifyEmailViaOobCode(auth, email)
  return credential
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
