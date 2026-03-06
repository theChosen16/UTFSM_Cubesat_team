import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from '@/pages/Register'

const mockSignUp = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: {},
}))

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  )
}

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the registration form', () => {
    renderRegister()

    expect(screen.getByText('Únete al equipo')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Juan')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Pérez')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('nombre@usm.cl')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument()
  })

  it('shows error for non-institutional email', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('Juan'), 'Alejandro')
    await user.type(screen.getByPlaceholderText('Pérez'), 'Hernandez')
    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'test@gmail.com')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Falopa123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'Falopa123')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(screen.getByText(/correo institucional de la USM/i)).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('Juan'), 'Alejandro')
    await user.type(screen.getByPlaceholderText('Pérez'), 'Hernandez')
    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Falopa123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'DifferentPass')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('shows error for short password', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('Juan'), 'Alejandro')
    await user.type(screen.getByPlaceholderText('Pérez'), 'Hernandez')
    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], '123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], '123')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(screen.getByText('La contraseña debe tener al menos 6 caracteres')).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('navigates to dashboard on successful registration', async () => {
    mockSignUp.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('Juan'), 'Alejandro')
    await user.type(screen.getByPlaceholderText('Pérez'), 'Hernandez')
    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Falopa123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'Falopa123')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'alejandro.hernandeza@sansano.usm.cl',
        'Falopa123',
        'Alejandro',
        'Hernandez'
      )
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows error when email is already in use without attempting auto-signin', async () => {
    const firebaseError = new Error('Email already in use')
    Object.assign(firebaseError, { code: 'auth/email-already-in-use' })
    mockSignUp.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('Juan'), 'Alejandro')
    await user.type(screen.getByPlaceholderText('Pérez'), 'Hernandez')
    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Falopa123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'Falopa123')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => {
      expect(screen.getByText('Este correo ya está registrado. Inicia sesión desde la página de login.')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('accepts @sansano.usm.cl emails', async () => {
    mockSignUp.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByPlaceholderText('Juan'), 'Alejandro')
    await user.type(screen.getByPlaceholderText('Pérez'), 'Hernandez')
    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Falopa123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'Falopa123')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled()
    })
  })
})
