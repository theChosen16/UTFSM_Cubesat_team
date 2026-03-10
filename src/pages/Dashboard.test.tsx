import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '@/pages/Dashboard'
import { User as UserType } from '@/types'

const mockGetDocs = vi.fn()

const mockUser: Partial<UserType> = {
  id: 'user1',
  email: 'maestro@usm.cl',
  nombre: 'Alejandro',
  apellido: 'Hernandez',
  rol: 'maestro',
  genero: 'masculino',
  createdAt: new Date(),
  isActive: true,
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
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
  return { docs: [], size: 0 }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDocs.mockResolvedValue(emptySnapshot())
  })

  it('renders welcome message with user name', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('¡Bienvenido, Alejandro!')).toBeInTheDocument()
    })
  })

  it('renders feminine greeting for female user', async () => {
    mockUser.genero = 'femenino'
    mockUser.nombre = 'María'
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('¡Bienvenida, María!')).toBeInTheDocument()
    })
    // Reset
    mockUser.genero = 'masculino'
    mockUser.nombre = 'Alejandro'
  })

  it('shows user role label', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Usuario Maestro')).toBeInTheDocument()
    })
  })

  it('renders stat cards', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Proyectos Activos')).toBeInTheDocument()
      expect(screen.getByText('Tareas Activas')).toBeInTheDocument()
      expect(screen.getByText('Completadas')).toBeInTheDocument()
      expect(screen.getByText('Miembros')).toBeInTheDocument()
    })
  })

  it('renders team structure section', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Estructura del Equipo')).toBeInTheDocument()
    })
  })

  it('renders recent projects section', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Proyectos Recientes')).toBeInTheDocument()
    })
  })

  it('shows empty project state message', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('No hay proyectos registrados aún.')).toBeInTheDocument()
    })
  })

  it('shows loading indicators then stats values', async () => {
    const usersSnapshot = {
      docs: [
        { data: () => ({ rol: undefined, equipo: 'tecnico' }) },
        { data: () => ({ rol: 'maestro', equipo: 'manager' }) },
      ],
      size: 2,
    }
    const projectsSnapshot = {
      docs: [
        { data: () => ({ estado: 'en_progreso' }) },
      ],
      size: 1,
    }
    const tasksSnapshot = {
      docs: [
        { data: () => ({ estado: 'pendiente' }) },
        { data: () => ({ estado: 'completado' }) },
      ],
      size: 2,
    }

    mockGetDocs
      .mockResolvedValueOnce(usersSnapshot)
      .mockResolvedValueOnce(projectsSnapshot)
      .mockResolvedValueOnce(tasksSnapshot)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument() // Members
    })
  })

  it('counts team members by equipo field, not by role', async () => {
    const usersSnapshot = {
      docs: [
        { data: () => ({ rol: 'admin', equipo: 'tecnico' }) },
        { data: () => ({ rol: undefined, equipo: 'tecnico' }) },
        { data: () => ({ rol: 'admin' }) },
      ],
      size: 3,
    }
    const emptySnap = { docs: [], size: 0 }

    mockGetDocs
      .mockResolvedValueOnce(usersSnapshot)
      .mockResolvedValueOnce(emptySnap)
      .mockResolvedValueOnce(emptySnap)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('2 miembros')).toBeInTheDocument()
    })
  })

  it('handles error when loading stats', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'))

    renderDashboard()

    // Should not crash
    await waitFor(() => {
      expect(screen.getByText('¡Bienvenido, Alejandro!')).toBeInTheDocument()
    })
  })
})
