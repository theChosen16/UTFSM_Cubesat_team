import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import type { User } from '@/types'

const mockUpdateUserProfile = vi.fn()
const mockResendVerificationEmail = vi.fn()
const mockRefreshVerificationStatus = vi.fn()
const mockSignOut = vi.fn()

let mockFirebaseUser: { email: string | null; emailVerified: boolean } | null = null

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: mockFirebaseUser,
    updateUserProfile: mockUpdateUserProfile,
    resendVerificationEmail: mockResendVerificationEmail,
    refreshVerificationStatus: mockRefreshVerificationStatus,
    signOut: mockSignOut,
  }),
}))

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, analytics: null }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const member: User = {
  id: 'uid-1',
  email: 'sofia.galaz@usm.cl',
  nombre: 'Sofía',
  apellido: 'Galaz',
  createdAt: new Date(),
  isActive: true,
}

function renderRoute(user: User | null) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user}>
              <div>Contenido privado</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>
  )
}

/**
 * An @usm.cl address is not membership until its owner has shown they can receive mail at it —
 * Firebase's email/password sign-up never checks that, so without this gate anyone could type a
 * plausible institutional address and reach the private workspace under a real member's name.
 * `isInstitutional()` in firestore.rules now requires `email_verified`; this gate is the
 * self-service path that makes enforcing it safe for members who registered before it existed.
 */
describe('ProtectedRoute — verification gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFirebaseUser = null
  })

  it('redirects to login when there is no session', () => {
    renderRoute(null)
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('blocks the app for an unverified institutional account', () => {
    mockFirebaseUser = { email: 'sofia.galaz@usm.cl', emailVerified: false }
    renderRoute(member)

    expect(screen.getByText('Verifica tu correo institucional')).toBeInTheDocument()
    expect(screen.getByText('sofia.galaz@usm.cl')).toBeInTheDocument()
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })

  it('renders the app once the address is verified', () => {
    mockFirebaseUser = { email: 'sofia.galaz@usm.cl', emailVerified: true }
    renderRoute(member)

    expect(screen.getByText('Contenido privado')).toBeInTheDocument()
  })

  it('resends the verification mail on request', async () => {
    mockFirebaseUser = { email: 'sofia.galaz@usm.cl', emailVerified: false }
    mockResendVerificationEmail.mockResolvedValue(undefined)
    renderRoute(member)

    await userEvent.click(screen.getByRole('button', { name: /reenviar correo/i }))

    await waitFor(() => expect(mockResendVerificationEmail).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/reenviado/i)).toBeInTheDocument()
  })

  it('reports that the account is still unverified when the re-check comes back false', async () => {
    mockFirebaseUser = { email: 'sofia.galaz@usm.cl', emailVerified: false }
    mockRefreshVerificationStatus.mockResolvedValue(false)
    renderRoute(member)

    await userEvent.click(screen.getByRole('button', { name: /ya verifiqué/i }))

    await waitFor(() => expect(mockRefreshVerificationStatus).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/aún figura como no verificada/i)).toBeInTheDocument()
  })

  it('still asks for the missing name once the address is verified', () => {
    mockFirebaseUser = { email: 'sofia.galaz@usm.cl', emailVerified: true }
    renderRoute({ ...member, apellido: '' })

    expect(screen.getByText('Completa tu perfil')).toBeInTheDocument()
  })
})
