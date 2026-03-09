import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TaskManagement from '@/pages/TaskManagement'

const mockGetDocs = vi.fn()
const mockAddDoc = vi.fn()
const mockUpdateDoc = vi.fn()

import { User as UserType } from '@/types'

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  doc: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Default: maestro user
const mockUser: Partial<UserType> = {
  id: 'user1',
  email: 'maestro@usm.cl',
  nombre: 'Test',
  apellido: 'Maestro',
  rol: 'maestro',
  createdAt: new Date(),
  isActive: true,
}

let currentMockUser: Partial<UserType> = mockUser

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
  }),
}))

function emptySnapshot() {
  return { docs: [] }
}

function renderTaskManagement() {
  return render(
    <MemoryRouter>
      <TaskManagement />
    </MemoryRouter>
  )
}

describe('TaskManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentMockUser = mockUser
    mockGetDocs.mockResolvedValue(emptySnapshot())
  })

  it('renders the task management page header', async () => {
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByText('Gestión de Tareas')).toBeInTheDocument()
    })
  })

  it('shows empty state when no tasks exist', async () => {
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByText('No hay tareas registradas aún.')).toBeInTheDocument()
    })
  })

  it('shows "Nueva Tarea" button for maestro users', async () => {
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })
  })

  it('shows task creation form when clicking "Nueva Tarea"', async () => {
    const user = userEvent.setup()
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))

    expect(screen.getByText('Título *')).toBeInTheDocument()
    expect(screen.getByText('Descripción')).toBeInTheDocument()
    expect(screen.getByText('Proyecto')).toBeInTheDocument()
    expect(screen.getByText('Equipo encargado')).toBeInTheDocument()
    expect(screen.getByText('Prioridad')).toBeInTheDocument()
    expect(screen.getByText('Responsable(s)')).toBeInTheDocument()
  })

  it('does not show "Nueva Tarea" button for tecnico users', async () => {
    currentMockUser = { ...mockUser, rol: 'tecnico' }

    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByText('Gestión de Tareas')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /nueva tarea/i })).not.toBeInTheDocument()
  })

  it('shows admin users the "Nueva Tarea" button', async () => {
    currentMockUser = { ...mockUser, rol: 'admin' }

    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })
  })

  it('disables "Crear Tarea" button when title is empty', async () => {
    const user = userEvent.setup()
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))

    const createButton = screen.getByRole('button', { name: /crear tarea/i })
    expect(createButton).toBeDisabled()
  })
})
