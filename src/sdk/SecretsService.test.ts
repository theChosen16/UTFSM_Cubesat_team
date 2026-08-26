import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDocMock = vi.fn()
const onAuthStateChangedMock = vi.fn()
const loggerMock = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

const authState: { currentUser: { uid: string } | null } = { currentUser: { uid: 'member-uid' } }

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
}))

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({ path: args.slice(1).join('/') }),
  getDoc: (...args: unknown[]) => getDocMock(...args),
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
  get auth() {
    return authState
  },
}))

vi.mock('@/lib/logger', () => ({ logger: loggerMock }))

const withRemoteUrl = (driveUploadUrl: unknown) => {
  getDocMock.mockResolvedValue({
    exists: () => true,
    data: () => ({ driveUploadUrl, driveUploadSecret: 'shared-secret' }),
  })
}

const loadService = async () => {
  const { SecretsService } = await import('@/sdk/SecretsService')
  SecretsService.clearCache()
  return SecretsService
}

describe('SecretsService — anclaje del endpoint del bridge', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    authState.currentUser = { uid: 'member-uid' }
    import.meta.env.DEV = false
  })

  it('acepta un despliegue legítimo de Apps Script', async () => {
    withRemoteUrl('https://script.google.com/macros/s/AKfycb-real/exec')
    const SecretsService = await loadService()

    const secrets = await SecretsService.getSecrets()

    expect(secrets.driveUploadUrl).toBe('https://script.google.com/macros/s/AKfycb-real/exec')
    expect(secrets.driveUploadSecret).toBe('shared-secret')
  })

  it.each([
    ['un host arbitrario', 'https://evil.example.com/collect'],
    ['un look-alike del host permitido', 'https://script.google.com.evil.example/exec'],
    ['un subdominio no permitido', 'https://attacker.script.google.com/exec'],
    ['texto que no es una URL', 'no-es-una-url'],
    ['un esquema no https', 'http://script.google.com/macros/s/AKfycb-real/exec'],
    ['un valor no textual', 42],
  ])('rechaza %s y falla cerrado', async (_label, url) => {
    withRemoteUrl(url)
    const SecretsService = await loadService()

    const secrets = await SecretsService.getSecrets()

    // Sin endpoint no se envía nada: ni el ID token del usuario, ni archivos, ni el historial.
    expect(secrets).toEqual({ driveUploadUrl: null, driveUploadSecret: null })
    expect(loggerMock.error).toHaveBeenCalled()
  })

  it('no cachea un endpoint rechazado', async () => {
    withRemoteUrl('https://evil.example.com/collect')
    const SecretsService = await loadService()
    await SecretsService.getSecrets()

    withRemoteUrl('https://script.googleusercontent.com/macros/echo?user_content_key=abc')
    const secrets = await SecretsService.getSecrets()

    expect(secrets.driveUploadUrl).toBe('https://script.googleusercontent.com/macros/echo?user_content_key=abc')
  })
})
