import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '@/pages/Login'

const mockSignIn = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock firebase modules to prevent initialization errors
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the login form', () => {
    renderLogin()

    expect(screen.getByText('Bienvenido de vuelta')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('nombre@usm.cl')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('navigates to dashboard on successful login', async () => {
    mockSignIn.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'Falopa123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('alejandro.hernandeza@sansano.usm.cl', 'Falopa123')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows specific error for invalid credentials', async () => {
    const firebaseError = new Error('Invalid credentials')
    Object.assign(firebaseError, { code: 'auth/invalid-credential' })
    mockSignIn.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas. Verifica tu email y contraseña.')).toBeInTheDocument()
    })
  })

  it('shows specific error for user not found', async () => {
    const firebaseError = new Error('User not found')
    Object.assign(firebaseError, { code: 'auth/user-not-found' })
    mockSignIn.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'noexiste@usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'somepassword')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(screen.getByText('No existe una cuenta con este correo electrónico.')).toBeInTheDocument()
    })
  })

  it('shows specific error for wrong password', async () => {
    const firebaseError = new Error('Wrong password')
    Object.assign(firebaseError, { code: 'auth/wrong-password' })
    mockSignIn.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(screen.getByText('La contraseña es incorrecta.')).toBeInTheDocument()
    })
  })

  it('shows specific error for too many requests', async () => {
    const firebaseError = new Error('Too many requests')
    Object.assign(firebaseError, { code: 'auth/too-many-requests' })
    mockSignIn.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'somepassword')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(screen.getByText('Demasiados intentos fallidos. Intenta de nuevo más tarde.')).toBeInTheDocument()
    })
  })

  it('shows specific error for network failure', async () => {
    const firebaseError = new Error('Network error')
    Object.assign(firebaseError, { code: 'auth/network-request-failed' })
    mockSignIn.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'somepassword')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(screen.getByText('Error de conexión. Verifica tu conexión a internet o desactiva tu bloqueador de anuncios.')).toBeInTheDocument()
    })
  })

  it('shows ad-blocker warning for blocked requests', async () => {
    const blockedError = new Error('Failed to fetch')
    mockSignIn.mockRejectedValueOnce(blockedError)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'somepassword')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(screen.getByText(/bloqueador de anuncios/)).toBeInTheDocument()
    })
  })

  it('shows specific error for disabled account', async () => {
    const firebaseError = new Error('User disabled')
    Object.assign(firebaseError, { code: 'auth/user-disabled' })
    mockSignIn.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'somepassword')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(screen.getByText('Esta cuenta ha sido deshabilitada.')).toBeInTheDocument()
    })
  })

  it('shows loading state while signing in', async () => {
    let resolveSignIn: () => void
    mockSignIn.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveSignIn = resolve
    }))
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'Falopa123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(screen.getByText('Iniciando sesión...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()

    resolveSignIn!()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('does not navigate on failed login', async () => {
    const firebaseError = new Error('Invalid credentials')
    Object.assign(firebaseError, { code: 'auth/invalid-credential' })
    mockSignIn.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
