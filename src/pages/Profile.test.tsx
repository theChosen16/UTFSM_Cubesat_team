import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Profile from '@/pages/Profile'
import { User as UserType } from '@/types'

const mockUpdateUserProfile = vi.fn()
const mockGetDocs = vi.fn()
const mockAddDoc = vi.fn()

let currentMockUser: UserType = {
  id: 'user1',
  email: 'test@sansano.usm.cl',
  nombre: 'Alejandro',
  apellido: 'Hernandez',
  rol: 'maestro',
  equipo: 'tecnico',
  createdAt: new Date(),
  isActive: true,
  career: 'Ingeniería Civil Informática',
  year: '4',
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    updateUserProfile: mockUpdateUserProfile,
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
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  )
}

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentMockUser = {
      id: 'user1',
      email: 'test@sansano.usm.cl',
      nombre: 'Alejandro',
      apellido: 'Hernandez',
      rol: 'maestro',
      equipo: 'tecnico',
      createdAt: new Date(),
      isActive: true,
      career: 'Ingeniería Civil Informática',
      year: '4',
    }
    mockGetDocs.mockResolvedValue({ docs: [], empty: true })
  })

  it('renders user profile information', () => {
    renderProfile()

    expect(screen.getByText('Mi Perfil')).toBeInTheDocument()
    expect(screen.getByText('Alejandro Hernandez')).toBeInTheDocument()
    // Email may appear multiple times in the profile page
    expect(screen.getAllByText('test@sansano.usm.cl').length).toBeGreaterThanOrEqual(1)
  })

  it('shows user role', () => {
    renderProfile()

    expect(screen.getByText('Usuario Maestro')).toBeInTheDocument()
  })

  it('shows role description', () => {
    renderProfile()

    expect(screen.getByText(/Dueño del sistema/)).toBeInTheDocument()
  })

  it('shows user career when set', () => {
    renderProfile()

    expect(screen.getByText('Ingeniería Civil Informática')).toBeInTheDocument()
  })

  it('shows edit button', () => {
    renderProfile()

    expect(screen.getByRole('button', { name: /completar cuestionario/i })).toBeInTheDocument()
  })

  it('shows edit form when clicking edit button', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByRole('button', { name: /completar cuestionario/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument()
    })
  })

  it('shows team selection in profile', () => {
    renderProfile()

    expect(screen.getByText('Equipo Técnico')).toBeInTheDocument()
  })

  it('does not show role request section for maestro users', () => {
    renderProfile()

    // Maestro and admin don't see role request section  
    expect(screen.queryByRole('button', { name: /solicitar cambio de rol/i })).not.toBeInTheDocument()
  })

  it('shows gender selection in edit mode', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByRole('button', { name: /completar cuestionario/i }))

    await waitFor(() => {
      const generoSelect = screen.getByTitle('Seleccionar género')
      expect(generoSelect).toBeInTheDocument()
    })
  })

  it('shows photo upload overlay on avatar hover', () => {
    renderProfile()

    // The file input for photo upload should exist
    const fileInput = document.querySelector('input[type="file"][accept="image/*"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('shows role request section for non-maestro/non-admin users', () => {
    currentMockUser = { ...currentMockUser, rol: 'tecnico' }
    renderProfile()

    // Should have a button to initiate a role request
    expect(screen.getByRole('button', { name: /solicitar cambio de rol/i })).toBeInTheDocument()
  })

  it('renders fallback initials when user names are missing', () => {
    currentMockUser = {
      ...currentMockUser,
      nombre: undefined as unknown as string,
      apellido: undefined as unknown as string,
    }

    renderProfile()

    expect(screen.getByText('??')).toBeInTheDocument()
  })
})
