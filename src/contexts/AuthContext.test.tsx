import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

const {
  mockOnAuthStateChanged,
  mockGetDoc,
  mockSetDoc,
  mockDoc,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockDoc: vi.fn(() => ({})),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('@/sdk/UserService', () => ({
  UserService: {
    updateProfile: vi.fn(),
    updateRole: vi.fn(),
    updateTeams: vi.fn(),
    getAll: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function AuthSnapshot() {
  const { user, loading } = useAuth()

  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="nombre">{user?.nombre ?? 'none'}</span>
      <span data-testid="apellido">{user?.apellido ?? 'none'}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes a fallback authenticated user before Firestore profile hydration finishes', async () => {
    let authStateHandler: ((user: { uid: string; email: string; displayName: string | null } | null) => Promise<void> | void) | undefined
    let resolveUserDoc: ((value: { exists: () => boolean; data: () => Record<string, unknown> }) => void) | undefined

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: typeof authStateHandler) => {
      authStateHandler = callback
      return () => undefined
    })

    mockGetDoc.mockImplementationOnce(() => new Promise((resolve) => {
      resolveUserDoc = resolve
    }))

    render(
      <AuthProvider>
        <AuthSnapshot />
      </AuthProvider>
    )

    act(() => {
      void authStateHandler?.({
        uid: 'user-1',
        email: 'test.miembro@sansano.usm.cl',
        displayName: null,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('email')).toHaveTextContent('test.miembro@sansano.usm.cl')
      expect(screen.getByTestId('nombre')).toHaveTextContent('Test')
      expect(screen.getByTestId('apellido')).toHaveTextContent('Miembro')
      expect(screen.getByTestId('loading')).toHaveTextContent('loading')
    })

    await act(async () => {
      resolveUserDoc?.({
        exists: () => true,
        data: () => ({
          email: 'test.miembro@sansano.usm.cl',
          nombre: 'Test',
          apellido: 'Miembro',
          createdAt: new Date(),
          isActive: true,
        }),
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      expect(screen.getByTestId('nombre')).toHaveTextContent('Test')
      expect(screen.getByTestId('apellido')).toHaveTextContent('Miembro')
    })
  })

  describe('legacy profile auto-repair', () => {
    const signIn = async (docData: Record<string, unknown>) => {
      let authStateHandler: ((user: { uid: string; email: string; displayName: string | null } | null) => Promise<void> | void) | undefined

      mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: typeof authStateHandler) => {
        authStateHandler = callback
        return () => undefined
      })
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => docData })

      render(
        <AuthProvider>
          <AuthSnapshot />
        </AuthProvider>
      )

      await act(async () => {
        await authStateHandler?.({
          uid: 'user-legacy',
          email: 'ana.soto@usm.cl',
          displayName: null,
        })
      })
    }

    // The notification rules verify the name STORED on the profile, so a legacy document with no
    // name must actually be healed — not merely rendered with a name derived on the fly.
    it('persists the derived name when only the name is missing', async () => {
      mockSetDoc.mockResolvedValue(undefined)

      await signIn({ email: 'ana.soto@usm.cl', createdAt: new Date(), isActive: true })

      expect(mockSetDoc).toHaveBeenCalledTimes(1)
      expect(mockSetDoc.mock.calls[0][1]).toEqual({ nombre: 'Ana', apellido: 'Soto' })
    })

    // 'email' is not in the rules' self-update allowlist, so bundling it with the name fields made
    // the whole write fail for a regular member and the names were never healed.
    it('repairs the name in its own write when the email is missing too', async () => {
      mockSetDoc.mockResolvedValue(undefined)

      await signIn({ createdAt: new Date(), isActive: true })

      expect(mockSetDoc).toHaveBeenCalledTimes(2)
      const patches = mockSetDoc.mock.calls.map(call => call[1])
      expect(patches).toContainEqual({ email: 'ana.soto@usm.cl' })
      expect(patches).toContainEqual({ nombre: 'Ana', apellido: 'Soto' })
    })

    it('still heals the name when the email repair is denied by the rules', async () => {
      mockSetDoc
        .mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }))
        .mockResolvedValueOnce(undefined)

      await signIn({ createdAt: new Date(), isActive: true })

      expect(mockSetDoc).toHaveBeenCalledTimes(2)
      expect(mockSetDoc.mock.calls[1][1]).toEqual({ nombre: 'Ana', apellido: 'Soto' })

      // And the denial must not cost the caller their hydrated profile for the session.
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready')
        expect(screen.getByTestId('nombre')).toHaveTextContent('Ana')
        expect(screen.getByTestId('apellido')).toHaveTextContent('Soto')
      })
    })

    // The repair writes are await points between the staleness check after getDoc and the final
    // setUser. A sign-out landing in that window must not be undone by the stale continuation.
    it('does not resurrect the previous user when sign-out lands mid-repair', async () => {
      let authStateHandler: ((user: { uid: string; email: string; displayName: string | null } | null) => Promise<void> | void) | undefined

      mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: typeof authStateHandler) => {
        authStateHandler = callback
        return () => undefined
      })
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ email: 'ana.soto@usm.cl', createdAt: new Date(), isActive: true }),
      })

      let releaseRepair: (() => void) | undefined
      mockSetDoc.mockImplementation(() => new Promise<void>((resolve) => {
        releaseRepair = () => resolve()
      }))

      render(
        <AuthProvider>
          <AuthSnapshot />
        </AuthProvider>
      )

      let signInSettled: Promise<void> | void
      act(() => {
        signInSettled = authStateHandler?.({
          uid: 'user-legacy',
          email: 'ana.soto@usm.cl',
          displayName: null,
        })
      })

      await waitFor(() => expect(mockSetDoc).toHaveBeenCalled())

      // Sign-out arrives while the repair write is still in flight.
      await act(async () => {
        await authStateHandler?.(null)
      })
      expect(screen.getByTestId('email')).toHaveTextContent('none')

      // The in-flight repair now settles and the stale continuation resumes.
      await act(async () => {
        releaseRepair?.()
        await signInSettled
      })

      expect(screen.getByTestId('email')).toHaveTextContent('none')
      expect(screen.getByTestId('nombre')).toHaveTextContent('none')
    })

    it('does not write anything when the profile is already complete', async () => {
      await signIn({
        email: 'ana.soto@usm.cl',
        nombre: 'Ana',
        apellido: 'Soto',
        createdAt: new Date(),
        isActive: true,
      })

      expect(mockSetDoc).not.toHaveBeenCalled()
    })
  })
})