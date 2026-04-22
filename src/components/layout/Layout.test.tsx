import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Layout from '@/components/layout/Layout'

const signOutMock = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'alejandro@usm.cl',
      nombre: 'Alejandro',
      apellido: 'Hernandez',
      equipos: ['manager'],
      rol: 'admin',
    },
    signOut: signOutMock,
  }),
}))

vi.mock('@/components/chat/Chatbot', () => ({
  Chatbot: () => <div data-testid="chatbot-stub">Chatbot</div>,
}))

describe('Layout', () => {
  beforeEach(() => {
    signOutMock.mockReset()
  })

  it('renders children and chatbot for authenticated users', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Layout>
          <div>Contenido protegido</div>
        </Layout>
      </MemoryRouter>
    )

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument()
    expect(screen.getByTestId('chatbot-stub')).toBeInTheDocument()
  })

  it('toggles the mobile navigation drawer from the menu button', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Layout>
          <div>Contenido protegido</div>
        </Layout>
      </MemoryRouter>
    )

    const menuButton = screen.getByRole('button', { name: /abrir menú/i })
    const sidebar = screen.getByRole('navigation', { name: /navegación principal/i })

    expect(sidebar.className).toContain('-translate-x-full')

    await user.click(menuButton)

    expect(screen.getByRole('button', { name: /cerrar menú/i })).toBeInTheDocument()
    expect(sidebar.className).toContain('translate-x-0')
  })
})