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
  roles: ['maestro'],
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

  it('does not show "Nueva Tarea" button for regular members', async () => {
    currentMockUser = { ...mockUser, roles: [], equipo: 'tecnico' }

    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByText('Gestión de Tareas')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /nueva tarea/i })).not.toBeInTheDocument()
  })

  it('shows admin users the "Nueva Tarea" button', async () => {
    currentMockUser = { ...mockUser, roles: ['admin'] }

    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })
  })

  it('shows manager team members the "Nueva Tarea" button', async () => {
    currentMockUser = { ...mockUser, equipo: 'manager' }

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

  it('enables "Crear Tarea" button when title has content', async () => {
    const user = userEvent.setup()
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    await user.type(screen.getByPlaceholderText('Nombre de la tarea'), 'Mi Tarea')

    const createButton = screen.getByRole('button', { name: /crear tarea/i })
    expect(createButton).not.toBeDisabled()
  })

  it('calls addDoc with correct data on task creation', async () => {
    mockAddDoc.mockResolvedValue({ id: 'new-task-id' })
    const user = userEvent.setup()
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    await user.type(screen.getByPlaceholderText('Nombre de la tarea'), 'Diseñar PCB')
    await user.type(screen.getByPlaceholderText('Describe la tarea en detalle...'), 'Diseño del circuito')
    await user.click(screen.getByRole('button', { name: /crear tarea/i }))

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1)
    })

    const callArgs = mockAddDoc.mock.calls[0][1]
    expect(callArgs.titulo).toBe('Diseñar PCB')
    expect(callArgs.descripcion).toBe('Diseño del circuito')
    expect(callArgs.estado).toBe('pendiente')
    expect(callArgs.prioridad).toBe('media')
    expect(callArgs.creadoPor).toBe('user1')
  })

  it('resets form after successful task creation', async () => {
    mockAddDoc.mockResolvedValue({ id: 'new-task-id' })
    const user = userEvent.setup()
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    await user.type(screen.getByPlaceholderText('Nombre de la tarea'), 'Test Task')
    await user.click(screen.getByRole('button', { name: /crear tarea/i }))

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled()
    })

    // Form should be hidden after successful creation
    await waitFor(() => {
      expect(screen.queryByText('Título *')).not.toBeInTheDocument()
    })
  })

  it('shows error message on task creation failure', async () => {
    mockAddDoc.mockRejectedValue(new Error('Permission denied'))
    const user = userEvent.setup()
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    await user.type(screen.getByPlaceholderText('Nombre de la tarea'), 'Failing Task')
    await user.click(screen.getByRole('button', { name: /crear tarea/i }))

    await waitFor(() => {
      expect(screen.getByText('Error al crear la tarea. Verifica tus permisos e intenta de nuevo.')).toBeInTheDocument()
    })
  })

  it('closes form when clicking cancel', async () => {
    const user = userEvent.setup()
    renderTaskManagement()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva tarea/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    expect(screen.getByText('Título *')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(screen.queryByText('Título *')).not.toBeInTheDocument()
  })
})
