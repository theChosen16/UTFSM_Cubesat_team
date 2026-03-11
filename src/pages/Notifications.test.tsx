import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Notifications from '@/pages/Notifications'
import { User as UserType } from '@/types'

const mockGetDocs = vi.fn()
const mockUpdateDoc = vi.fn()
const mockAddDoc = vi.fn()
const mockGetAllUsers = vi.fn()

let currentMockUser: Partial<UserType> = {
  id: 'user1',
  email: 'maestro@usm.cl',
  nombre: 'Test',
  apellido: 'Maestro',
  roles: ['maestro'],
  createdAt: new Date(),
  isActive: true,
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
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
      roles: ['maestro'],
      createdAt: new Date(),
      isActive: true,
    }
    mockGetDocs.mockResolvedValue(emptySnapshot())
    mockGetAllUsers.mockResolvedValue([])
  })

  it('renders inbox header for all users', async () => {
    currentMockUser = { ...currentMockUser, roles: [] }
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
    currentMockUser = { ...currentMockUser, roles: [] }
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Notificaciones')).toBeInTheDocument()
    })
  })

  it('shows messages tab for all users', async () => {
    currentMockUser = { ...currentMockUser, roles: [] }
    renderNotifications()

    await waitFor(() => {
      expect(screen.getByText('Mensajes')).toBeInTheDocument()
    })
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
      { id: 'user2', nombre: 'Carlos', apellido: 'Perez', email: 'carlos@usm.cl', roles: [], createdAt: new Date(), isActive: true },
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
