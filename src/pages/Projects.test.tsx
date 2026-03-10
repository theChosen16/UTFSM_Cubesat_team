import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Projects from '@/pages/Projects'
import { User as UserType } from '@/types'

const mockGetDocs = vi.fn()

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
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function emptySnapshot() {
  return { docs: [] }
}

function renderProjects() {
  return render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>
  )
}

describe('Projects', () => {
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

  it('renders the projects page header', async () => {
    renderProjects()

    await waitFor(() => {
      expect(screen.getByText('Proyectos')).toBeInTheDocument()
    })
  })

  it('shows "Nuevo Proyecto" button for maestro', async () => {
    renderProjects()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo proyecto/i })).toBeInTheDocument()
    })
  })

  it('shows "Nuevo Proyecto" button for admin', async () => {
    currentMockUser = { ...currentMockUser, rol: 'admin' }
    renderProjects()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo proyecto/i })).toBeInTheDocument()
    })
  })

  it('shows "Nuevo Proyecto" button for manager team member', async () => {
    currentMockUser = { ...currentMockUser, rol: undefined, equipo: 'manager' }
    renderProjects()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo proyecto/i })).toBeInTheDocument()
    })
  })

  it('does not show "Nuevo Proyecto" button for regular member', async () => {
    currentMockUser = { ...currentMockUser, rol: undefined, equipo: 'tecnico' }
    renderProjects()

    await waitFor(() => {
      expect(screen.getByText('Proyectos')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /nuevo proyecto/i })).not.toBeInTheDocument()
  })

  it('shows search input', async () => {
    renderProjects()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar proyectos...')).toBeInTheDocument()
    })
  })

  it('shows empty state when no projects exist', async () => {
    renderProjects()

    await waitFor(() => {
      expect(screen.getByText('No hay proyectos registrados aún.')).toBeInTheDocument()
    })
  })

  it('renders project cards when projects exist', async () => {
    const projectsSnapshot = {
      docs: [
        {
          id: 'p1',
          data: () => ({
            nombre: 'CubeSat Alpha',
            descripcion: 'First satellite project',
            estado: 'en_progreso',
            prioridad: 'alta',
            progress: 45,
            fechaLimite: '2025-12-31',
          }),
        },
      ],
    }
    mockGetDocs.mockResolvedValue(projectsSnapshot)

    renderProjects()

    await waitFor(() => {
      expect(screen.getByText('CubeSat Alpha')).toBeInTheDocument()
      expect(screen.getByText('First satellite project')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()
    })
  })

  it('filters projects by search query', async () => {
    const projectsSnapshot = {
      docs: [
        {
          id: 'p1',
          data: () => ({
            nombre: 'CubeSat Alpha',
            descripcion: 'First satellite',
            estado: 'en_progreso',
          }),
        },
        {
          id: 'p2',
          data: () => ({
            nombre: 'Ground Station',
            descripcion: 'Control station',
            estado: 'planificacion',
          }),
        },
      ],
    }
    mockGetDocs.mockResolvedValue(projectsSnapshot)
    const user = userEvent.setup()

    renderProjects()

    await waitFor(() => {
      expect(screen.getByText('CubeSat Alpha')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Buscar proyectos...'), 'Ground')

    expect(screen.getByText('Ground Station')).toBeInTheDocument()
    expect(screen.queryByText('CubeSat Alpha')).not.toBeInTheDocument()
  })

  it('handles error when loading projects', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'))

    renderProjects()

    await waitFor(() => {
      expect(screen.getByText('Proyectos')).toBeInTheDocument()
    })
  })

  it('filters projects with missing name/description without crashing', async () => {
    const projectsSnapshot = {
      docs: [
        {
          id: 'p1',
          data: () => ({
            estado: 'en_progreso',
          }),
        },
        {
          id: 'p2',
          data: () => ({
            nombre: 'CubeSat Alpha',
            descripcion: 'First satellite',
            estado: 'planificacion',
          }),
        },
      ],
    }
    mockGetDocs.mockResolvedValue(projectsSnapshot)
    const user = userEvent.setup()

    renderProjects()

    await waitFor(() => {
      expect(screen.getByText('CubeSat Alpha')).toBeInTheDocument()
    })

    // Should not crash when filtering with a project that has missing fields
    await user.type(screen.getByPlaceholderText('Buscar proyectos...'), 'Alpha')

    expect(screen.getByText('CubeSat Alpha')).toBeInTheDocument()
  })

  it('shows filters button', async () => {
    renderProjects()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filtros/i })).toBeInTheDocument()
    })
  })
})
