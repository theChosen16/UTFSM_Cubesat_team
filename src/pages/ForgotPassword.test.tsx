import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '@/pages/ForgotPassword'

const mockResetPassword = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    resetPassword: mockResetPassword,
  }),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

function renderForgotPassword() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the forgot password form', () => {
    renderForgotPassword()

    expect(screen.getByText('Recuperar Contraseña')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('nombre@usm.cl')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar enlace/i })).toBeInTheDocument()
  })

  it('shows success message on successful reset', async () => {
    mockResetPassword.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()

    renderForgotPassword()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'test@usm.cl')
    await user.click(screen.getByRole('button', { name: /enviar enlace/i }))

    await waitFor(() => {
      expect(screen.getByText(/Se ha enviado un correo para restablecer/)).toBeInTheDocument()
    })
  })

  it('shows error for user not found', async () => {
    const firebaseError = new Error('User not found')
    Object.assign(firebaseError, { code: 'auth/user-not-found' })
    mockResetPassword.mockRejectedValueOnce(firebaseError)
    const user = userEvent.setup()

    renderForgotPassword()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'noexiste@usm.cl')
    await user.click(screen.getByRole('button', { name: /enviar enlace/i }))

    await waitFor(() => {
      expect(screen.getByText('No existe una cuenta con este correo electrónico.')).toBeInTheDocument()
    })
  })

  it('shows generic error for other failures', async () => {
    mockResetPassword.mockRejectedValueOnce(new Error('Unknown error'))
    const user = userEvent.setup()

    renderForgotPassword()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'test@usm.cl')
    await user.click(screen.getByRole('button', { name: /enviar enlace/i }))

    await waitFor(() => {
      expect(screen.getByText('Ocurrió un error. Por favor intenta de nuevo.')).toBeInTheDocument()
    })
  })

  it('shows loading state while sending', async () => {
    let resolveReset: () => void
    mockResetPassword.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveReset = resolve
    }))
    const user = userEvent.setup()

    renderForgotPassword()

    await user.type(screen.getByPlaceholderText('nombre@usm.cl'), 'test@usm.cl')
    await user.click(screen.getByRole('button', { name: /enviar enlace/i }))

    expect(screen.getByText('Enviando...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()

    resolveReset!()

    await waitFor(() => {
      expect(screen.getByText(/Se ha enviado un correo/)).toBeInTheDocument()
    })
  })

  it('has link back to login page', () => {
    renderForgotPassword()

    expect(screen.getByText('Volver al inicio de sesión')).toBeInTheDocument()
    const link = screen.getByText('Volver al inicio de sesión').closest('a')
    expect(link).toHaveAttribute('href', '/login')
  })

  it('shows description text', () => {
    renderForgotPassword()

    expect(screen.getByText(/Ingresa tu correo institucional para recibir/)).toBeInTheDocument()
  })
})
