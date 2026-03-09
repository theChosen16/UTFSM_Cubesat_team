import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Notifications from '@/pages/Notifications'
import { User as UserType } from '@/types'

const mockGetDocs = vi.fn()
const mockUpdateUserRole = vi.fn()
const mockUpdateDoc = vi.fn()

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
  })

  it('shows permission denied for non-maestro users', () => {
    currentMockUser = { ...currentMockUser, rol: 'tecnico' }
    renderNotifications()

    expect(screen.getByText('No tienes permisos para ver esta página.')).toBeInTheDocument()
  })

  it('shows permission denied for admin users', () => {
    currentMockUser = { ...currentMockUser, rol: 'admin' }
    renderNotifications()

    expect(screen.getByText('No tienes permisos para ver esta página.')).toBeInTheDocument()
  })

  it('renders header for maestro users', async () => {
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Solicitudes de Rol')).toBeInTheDocument()
    })
  })

  it('shows empty state when no requests exist', async () => {
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('No hay solicitudes de rol.')).toBeInTheDocument()
    })
  })

  it('renders pending role requests', async () => {
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
    mockGetDocs.mockResolvedValue(requestsSnapshot)

    renderNotifications()

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
      expect(screen.getByText('Aprobado')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument()
  })

  it('shows pending count badge when there are pending requests', async () => {
    const requestsSnapshot = {
      docs: [
        {
          id: 'req1',
          data: () => ({
            userId: 'user2',
            userEmail: 'user@usm.cl',
            userName: 'Carlos',
            rolSolicitado: 'admin',
            mensaje: '',
            estado: 'pendiente',
            createdAt: { toDate: () => new Date() },
          }),
        },
        {
          id: 'req2',
          data: () => ({
            userId: 'user3',
            userEmail: 'user3@usm.cl',
            userName: 'Maria',
            rolSolicitado: 'manager',
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
      expect(screen.getByText('2 pendientes')).toBeInTheDocument()
    })
  })

  it('handles error when loading requests', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'))

    renderNotifications()

    // Should not crash
    await waitFor(() => {
      expect(screen.getByText('Solicitudes de Rol')).toBeInTheDocument()
    })
  })
})
