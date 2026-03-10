import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Notifications from '@/pages/Notifications'
import { User as UserType } from '@/types'

const mockGetDocs = vi.fn()
const mockUpdateUserRole = vi.fn()
const mockUpdateDoc = vi.fn()
const mockAddDoc = vi.fn()
const mockGetAllUsers = vi.fn()

let currentMockUser: Partial<UserType> = {
  id: 'user1',
  email: 'maestro@usm.cl',
  nombre: 'Test',
  apellido: 'Maestro',
  rol: 'maestro',
  createdAt: new Date(),
  isActive: true,
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    updateUserRole: mockUpdateUserRole,
    getAllUsers: mockGetAllUsers,
  }),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: vi.fn(),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function emptySnapshot() {
  return { docs: [] }
}

function renderNotifications() {
  return render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>
  )
}

describe('Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentMockUser = {
      id: 'user1',
      email: 'maestro@usm.cl',
      nombre: 'Test',
      apellido: 'Maestro',
      rol: 'maestro',
      createdAt: new Date(),
      isActive: true,
    }
    mockGetDocs.mockResolvedValue(emptySnapshot())
    mockGetAllUsers.mockResolvedValue([])
  })

  it('renders inbox header for all users', async () => {
    currentMockUser = { ...currentMockUser, rol: 'tecnico' }
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })
  })

  it('renders inbox header for maestro users', async () => {
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })
  })

  it('shows notifications tab for all users', async () => {
    currentMockUser = { ...currentMockUser, rol: 'tecnico' }
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Notificaciones')).toBeInTheDocument()
    })
  })

  it('shows messages tab for all users', async () => {
    currentMockUser = { ...currentMockUser, rol: 'tecnico' }
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Mensajes')).toBeInTheDocument()
    })
  })

  it('shows role requests tab only for maestro', async () => {
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Solicitudes de Rol')).toBeInTheDocument()
    })
  })

  it('does not show role requests tab for non-maestro users', async () => {
    currentMockUser = { ...currentMockUser, rol: 'tecnico' }
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })
    expect(screen.queryByText('Solicitudes de Rol')).not.toBeInTheDocument()
  })

  it('shows empty state for notifications', async () => {
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('No tienes notificaciones.')).toBeInTheDocument()
    })
  })

  it('shows empty state for messages when messages tab is clicked', async () => {
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Mensajes'))

    await waitFor(() => {
      expect(screen.getByText('No tienes mensajes.')).toBeInTheDocument()
    })
  })

  it('shows empty state for role requests when role requests tab is clicked', async () => {
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Solicitudes de Rol'))

    await waitFor(() => {
      expect(screen.getByText('No hay solicitudes de rol.')).toBeInTheDocument()
    })
  })

  it('renders pending role requests in role requests tab', async () => {
    const requestsSnapshot = {
      docs: [
        {
          id: 'req1',
          data: () => ({
            userId: 'user2',
            userEmail: 'user@usm.cl',
            userName: 'Carlos Perez',
            rolSolicitado: 'admin',
            mensaje: 'Quiero ser admin',
            estado: 'pendiente',
            createdAt: { toDate: () => new Date('2025-01-15') },
          }),
        },
      ],
    }
    // First call is for notifications (query), second for role_requests (collection)
    mockGetDocs.mockResolvedValue(requestsSnapshot)

    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Solicitudes de Rol'))

    await waitFor(() => {
      expect(screen.getByText('Carlos Perez')).toBeInTheDocument()
      expect(screen.getByText('user@usm.cl')).toBeInTheDocument()
      expect(screen.getByText('Quiero ser admin')).toBeInTheDocument()
      expect(screen.getByText('Pendiente')).toBeInTheDocument()
    })
  })

  it('shows approve and reject buttons for pending requests', async () => {
    const requestsSnapshot = {
      docs: [
        {
          id: 'req1',
          data: () => ({
            userId: 'user2',
            userEmail: 'user@usm.cl',
            userName: 'Carlos Perez',
            rolSolicitado: 'admin',
            mensaje: '',
            estado: 'pendiente',
            createdAt: { toDate: () => new Date() },
          }),
        },
      ],
    }
    mockGetDocs.mockResolvedValue(requestsSnapshot)

    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Solicitudes de Rol'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument()
    })
  })

  it('does not show action buttons for resolved requests', async () => {
    const requestsSnapshot = {
      docs: [
        {
          id: 'req1',
          data: () => ({
            userId: 'user2',
            userEmail: 'user@usm.cl',
            userName: 'Carlos Perez',
            rolSolicitado: 'admin',
            mensaje: '',
            estado: 'aprobado',
            createdAt: { toDate: () => new Date() },
            resolvedAt: { toDate: () => new Date() },
            resolvedBy: 'user1',
          }),
        },
      ],
    }
    mockGetDocs.mockResolvedValue(requestsSnapshot)

    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Solicitudes de Rol'))

    await waitFor(() => {
      expect(screen.getByText('Aprobado')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument()
  })

  it('shows new message button in messages tab', async () => {
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Mensajes'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo mensaje/i })).toBeInTheDocument()
    })
  })

  it('shows compose form when new message button is clicked', async () => {
    mockGetAllUsers.mockResolvedValue([
      { id: 'user2', nombre: 'Carlos', apellido: 'Perez', email: 'carlos@usm.cl', rol: 'tecnico', createdAt: new Date(), isActive: true },
    ])

    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Mensajes'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo mensaje/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /nuevo mensaje/i }))

    await waitFor(() => {
      expect(screen.getByText('Enviar Mensaje')).toBeInTheDocument()
      expect(screen.getByText('Destinatario')).toBeInTheDocument()
    })
  })

  it('handles error when loading notifications', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'))

    renderNotifications()

    // Should not crash
    await waitFor(() => {
      expect(screen.getByText('Buzón')).toBeInTheDocument()
    })
  })
})
