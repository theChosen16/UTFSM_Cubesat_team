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
    user: null,
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

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  )
}

/** Fill step 1 with valid data and advance to step 2 */
async function advanceToNameStep(user: ReturnType<typeof userEvent.setup>, email = 'alejandro.hernandeza@sansano.usm.cl') {
  await user.type(screen.getByPlaceholderText('nombre@usm.cl'), email)
  await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Falopa123')
  await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'Falopa123')
  await user.click(screen.getByRole('button', { name: /crear cuenta/i }))
}

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the registration form (step 1)', () => {
    renderRegister()

    expect(screen.getByText('Únete al equipo')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('nombre@usm.cl')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument()
    // nombre/apellido fields should NOT be visible in step 1
    expect(screen.queryByPlaceholderText('Juan')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Pérez')).not.toBeInTheDocument()
  })

  it('shows error for non-institutional email', async () => {
    const user = userEvent.setup()
    renderRegister()

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

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'alejandro.hernandeza@sansano.usm.cl')
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], '123')
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], '123')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(screen.getByText('La contraseña debe tener al menos 6 caracteres')).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('shows name step modal after valid step 1', async () => {
    const user = userEvent.setup()
    renderRegister()

    await advanceToNameStep(user)

    expect(screen.getByText('¿Cómo te llamas?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Juan')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Pérez')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument()
  })

  it('navigates to dashboard on successful registration', async () => {
    mockSignUp.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderRegister()

    await advanceToNameStep(user)

    // Clear pre-filled values and type new ones
    const nombreInput = screen.getByPlaceholderText('Juan')
    const apellidoInput = screen.getByPlaceholderText('Pérez')
    await user.clear(nombreInput)
    await user.clear(apellidoInput)
    await user.type(nombreInput, 'Alejandro')
    await user.type(apellidoInput, 'Hernandez')
    await user.click(screen.getByRole('button', { name: /continuar/i }))

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

    await advanceToNameStep(user)

    const nombreInput = screen.getByPlaceholderText('Juan')
    const apellidoInput = screen.getByPlaceholderText('Pérez')
    await user.clear(nombreInput)
    await user.clear(apellidoInput)
    await user.type(nombreInput, 'Alejandro')
    await user.type(apellidoInput, 'Hernandez')
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    await waitFor(() => {
      expect(screen.getByText('Este correo ya está registrado. Inicia sesión desde la página de login.')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('accepts @sansano.usm.cl emails', async () => {
    mockSignUp.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderRegister()

    await advanceToNameStep(user)

    const nombreInput = screen.getByPlaceholderText('Juan')
    const apellidoInput = screen.getByPlaceholderText('Pérez')
    await user.clear(nombreInput)
    await user.clear(apellidoInput)
    await user.type(nombreInput, 'Alejandro')
    await user.type(apellidoInput, 'Hernandez')
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled()
    })
  })

  it('auto-populates nombre and apellido from email in step 2', async () => {
    const user = userEvent.setup()
    renderRegister()

    await advanceToNameStep(user, 'alejandro.hernandeza@sansano.usm.cl')

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Juan')).toHaveValue('Alejandro')
      expect(screen.getByPlaceholderText('Pérez')).toHaveValue('Hernandeza')
    })
  })

  it('shows error when name fields are empty in step 2', async () => {
    const user = userEvent.setup()
    renderRegister()

    await advanceToNameStep(user)

    // Clear any pre-filled values
    const nombreInput = screen.getByPlaceholderText('Juan')
    const apellidoInput = screen.getByPlaceholderText('Pérez')
    await user.clear(nombreInput)
    await user.clear(apellidoInput)
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByText('Debes ingresar tu nombre y apellido para continuar')).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('allows going back from name step to email step', async () => {
    const user = userEvent.setup()
    renderRegister()

    await advanceToNameStep(user)
    expect(screen.getByText('¿Cómo te llamas?')).toBeInTheDocument()

    await user.click(screen.getByText('Volver'))

    expect(screen.queryByText('¿Cómo te llamas?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument()
  })
})
