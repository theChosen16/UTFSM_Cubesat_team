import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Login from '@/pages/Login'

const mockSignIn = vi.fn()
let mockAuthUser: { id: string; email: string } | null = null

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    user: mockAuthUser,
  }),
}))

// Mock firebase modules to prevent initialization errors
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/projects" element={<div>Projects</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthUser = null
  })

  it('renders the login form', () => {
    renderLogin()

    expect(screen.getByText('Bienvenido de vuelta')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('nombre@usm.cl')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('navigates to dashboard on successful login', async () => {
    mockSignIn.mockImplementationOnce(async () => {
      mockAuthUser = { id: 'user-1', email: 'alejandro.hernandeza@sansano.usm.cl' }
    })
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getByPlaceholderText('••••••••'), 'Falopa123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('alejandro.hernandeza@sansano.usm.cl', 'Falopa123')
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('normalizes mobile email input before submitting', async () => {
    mockSignIn.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), '  Alejandro.Hernandeza@Sansano.USM.CL  ')
    await user.type(screen.getByPlaceholderText('••••••••'), 'Falopa123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('alejandro.hernandeza@sansano.usm.cl', 'Falopa123')
    })
  })

  it('configures the email field for mobile keyboards', () => {
    renderLogin()

    const emailInput = screen.getByPlaceholderText('nombre@usm.cl')

    expect(emailInput).toHaveAttribute('autocapitalize', 'none')
    expect(emailInput).toHaveAttribute('autocorrect', 'off')
    expect(emailInput).toHaveAttribute('inputmode', 'email')
    expect(emailInput).toHaveAttribute('spellcheck', 'false')
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
      resolveSignIn = () => {
        mockAuthUser = { id: 'user-1', email: 'alejandro.hernandeza@sansano.usm.cl' }
        resolve()
      }
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
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
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
      expect(screen.getByText('Bienvenido de vuelta')).toBeInTheDocument()
    })
  })
})
