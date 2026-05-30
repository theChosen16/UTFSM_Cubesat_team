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
})