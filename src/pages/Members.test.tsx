import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Members from '@/pages/Members'
import { User as UserType } from '@/types'

const mockGetAllUsers = vi.fn()
const mockUpdateUserRole = vi.fn()

const mockCurrentUser: Partial<UserType> = {
  id: 'user1',
  email: 'maestro@usm.cl',
  nombre: 'Test',
  apellido: 'Maestro',
  rol: 'maestro',
  createdAt: new Date(),
  isActive: true,
}

let currentMockUser: Partial<UserType> = mockCurrentUser

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    getAllUsers: mockGetAllUsers,
    updateUserRole: mockUpdateUserRole,
  }),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const sampleMembers: UserType[] = [
  {
    id: 'user1',
    email: 'maestro@usm.cl',
    nombre: 'Test',
    apellido: 'Maestro',
    rol: 'maestro',
    equipo: 'tecnico',
    createdAt: new Date(),
    isActive: true,
  },
  {
    id: 'user2',
    email: 'admin@usm.cl',
    nombre: 'Admin',
    apellido: 'User',
    rol: 'admin',
    createdAt: new Date(),
    isActive: true,
  },
  {
    id: 'user3',
    email: 'tecnico@usm.cl',
    nombre: 'Tecnico',
    apellido: 'Dev',
    rol: 'tecnico',
    equipo: 'tecnico',
    createdAt: new Date(),
    isActive: true,
  },
]

function renderMembers() {
  return render(
    <MemoryRouter>
      <Members />
    </MemoryRouter>
  )
}

describe('Members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentMockUser = mockCurrentUser
    mockGetAllUsers.mockResolvedValue(sampleMembers)
  })

  it('renders the members page header', async () => {
    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Miembros del Equipo')).toBeInTheDocument()
    })
  })

  it('renders member cards after loading', async () => {
    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Test Maestro')).toBeInTheDocument()
      expect(screen.getByText('Admin User')).toBeInTheDocument()
      expect(screen.getByText('Tecnico Dev')).toBeInTheDocument()
    })
  })

  it('shows search input', async () => {
    renderMembers()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar miembros...')).toBeInTheDocument()
    })
  })

  it('filters members by search query', async () => {
    const user = userEvent.setup()
    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Test Maestro')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Buscar miembros...'), 'Admin')

    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.queryByText('Test Maestro')).not.toBeInTheDocument()
    expect(screen.queryByText('Tecnico Dev')).not.toBeInTheDocument()
  })

  it('filters members by email', async () => {
    const user = userEvent.setup()
    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Test Maestro')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Buscar miembros...'), 'tecnico@usm')

    expect(screen.getByText('Tecnico Dev')).toBeInTheDocument()
    expect(screen.queryByText('Test Maestro')).not.toBeInTheDocument()
  })

  it('shows empty state when no members match search', async () => {
    const user = userEvent.setup()
    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Test Maestro')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Buscar miembros...'), 'nonexistent')

    expect(screen.getByText('No se encontraron miembros')).toBeInTheDocument()
  })

  it('handles members with undefined nombre/apellido/email gracefully', async () => {
    const membersWithMissing: UserType[] = [
      {
        id: 'broken',
        email: undefined as unknown as string,
        nombre: undefined as unknown as string,
        apellido: undefined as unknown as string,
        rol: 'tecnico',
        createdAt: new Date(),
        isActive: true,
      },
    ]
    mockGetAllUsers.mockResolvedValue(membersWithMissing)

    renderMembers()

    // Should not crash – should render without error
    await waitFor(() => {
      expect(screen.getByText('Miembros del Equipo')).toBeInTheDocument()
    })
  })

  it('shows role management badge for maestro', async () => {
    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Gestión de roles habilitada')).toBeInTheDocument()
    })
  })

  it('shows role management badge for admin', async () => {
    currentMockUser = { ...mockCurrentUser, rol: 'admin' }

    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Gestión de roles habilitada')).toBeInTheDocument()
    })
  })

  it('does not show role management badge for tecnico', async () => {
    currentMockUser = { ...mockCurrentUser, rol: 'tecnico' }

    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Miembros del Equipo')).toBeInTheDocument()
    })
    expect(screen.queryByText('Gestión de roles habilitada')).not.toBeInTheDocument()
  })

  it('shows "(Tú)" label next to current user', async () => {
    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('(Tú)')).toBeInTheDocument()
    })
  })

  it('shows role change dropdown for other members when user is maestro', async () => {
    renderMembers()

    await waitFor(() => {
      const selects = screen.getAllByTitle('Cambiar rol del miembro')
      expect(selects.length).toBeGreaterThan(0)
    })
  })

  it('does not show role change for current user', async () => {
    mockGetAllUsers.mockResolvedValue([sampleMembers[0]]) // Only the current user
    renderMembers()

    await waitFor(() => {
      expect(screen.getByText('Test Maestro')).toBeInTheDocument()
    })
    expect(screen.queryByTitle('Cambiar rol del miembro')).not.toBeInTheDocument()
  })

  it('shows team info when member has equipo', async () => {
    renderMembers()

    await waitFor(() => {
      const teamLabels = screen.getAllByText('Equipo Técnico')
      expect(teamLabels.length).toBeGreaterThan(0)
    })
  })

  it('handles error when loading members fails', async () => {
    mockGetAllUsers.mockRejectedValue(new Error('Network error'))

    renderMembers()

    // Should not crash, should finish loading
    await waitFor(() => {
      expect(screen.getByText('Miembros del Equipo')).toBeInTheDocument()
    })
  })

  it('calls updateUserRole when changing role', async () => {
    const user = userEvent.setup()
    mockUpdateUserRole.mockResolvedValue(undefined)
    mockGetAllUsers.mockResolvedValue(sampleMembers)

    renderMembers()

    await waitFor(() => {
      expect(screen.getAllByTitle('Cambiar rol del miembro').length).toBeGreaterThan(0)
    })

    const selects = screen.getAllByTitle('Cambiar rol del miembro')
    await user.selectOptions(selects[0], 'manager')

    await waitFor(() => {
      expect(mockUpdateUserRole).toHaveBeenCalled()
    })
  })

  it('shows loading spinner initially', () => {
    mockGetAllUsers.mockReturnValue(new Promise(() => {})) // never resolves
    renderMembers()

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
