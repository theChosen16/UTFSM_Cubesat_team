import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Calendar from '@/pages/Calendar'
import { CalendarEvent, Task, User as UserType } from '@/types'

// Mock firebase imports
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Mock default user
let currentMockUser: Partial<UserType> = {
  id: 'user-manager',
  email: 'manager@usm.cl',
  nombre: 'Ale',
  apellido: 'Hernández',
  rol: 'maestro',
  equipos: ['manager'],
  createdAt: new Date(),
  isActive: true,
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
  }),
}))

// Mock Events and Tasks Data
const mockEvents: CalendarEvent[] = [
  {
    id: 'evt-1',
    titulo: 'Reunión de Coordinación',
    descripcion: 'Reunión para planificar la semana',
    fechaInicio: '2026-05-18T18:00:00',
    tipo: 'reunion',
    creadoPor: 'user-manager',
    createdAt: new Date(),
  },
  {
    id: 'evt-2',
    titulo: 'Competencia Principal CubeDesign',
    descripcion: 'Competencia en Brasil',
    fechaInicio: '2026-11-24T09:00:00',
    tipo: 'social',
    creadoPor: 'user-manager',
    createdAt: new Date(),
  },
]

const mockTasks: Task[] = [
  {
    id: 'task-1',
    projectId: 'proj-1',
    titulo: 'Inscripción a CubeDesign 2026',
    descripcion: 'Confirmar participantes y enviar planilla.',
    estado: 'pendiente',
    asignadoA: [],
    equipo: 'manager',
    prioridad: 'alta',
    creadoPor: 'user-manager',
    fechaLimite: '2026-05-22',
    puntajeImportancia: 10,
    createdAt: new Date(),
  },
  {
    id: 'task-2',
    projectId: 'proj-1',
    titulo: 'Lectura de Bases del CubeDesign 2026',
    descripcion: 'Revisar bases detalladamente.',
    estado: 'en_progreso',
    asignadoA: [],
    equipo: 'tecnico',
    prioridad: 'alta',
    creadoPor: 'user-manager',
    fechaLimite: '2026-05-25',
    puntajeImportancia: 5,
    createdAt: new Date(),
  },
]

const mockSubscribeAll = vi.fn((onNext: any, _onError?: any) => {
  onNext(mockEvents)
  return () => {}
})

const mockEventGetAll = vi.fn().mockResolvedValue(mockEvents)
const mockEventCreate = vi.fn().mockResolvedValue('new-evt-id')
const mockEventDelete = vi.fn().mockResolvedValue(undefined)

vi.mock('@/sdk/EventService', () => ({
  EventService: {
    getAll: () => mockEventGetAll(),
    create: (data: any) => mockEventCreate(data),
    delete: (id: string) => mockEventDelete(id),
    subscribeAll: (onNext: any, onError: any) => mockSubscribeAll(onNext, onError),
  },
}))

const mockTaskGetAll = vi.fn().mockResolvedValue(mockTasks)
const mockTaskCreate = vi.fn().mockResolvedValue('new-task-id')

vi.mock('@/sdk/TaskService', () => ({
  TaskService: {
    getAll: () => mockTaskGetAll(),
    create: (data: any) => mockTaskCreate(data),
  },
}))

function renderCalendar() {
  return render(
    <MemoryRouter>
      <Calendar />
    </MemoryRouter>
  )
}

describe('Calendar Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockImplementation(() => true)
    currentMockUser = {
      id: 'user-manager',
      email: 'manager@usm.cl',
      nombre: 'Ale',
      apellido: 'Hernández',
      rol: 'maestro',
      equipos: ['manager'],
      createdAt: new Date(),
      isActive: true,
    }
    mockTaskGetAll.mockResolvedValue(mockTasks)
    mockEventGetAll.mockResolvedValue(mockEvents)
  })

  it('renders the calendar page title and core layout', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Calendario de Actividades')).toBeInTheDocument()
      expect(
        screen.getByText('Planificación técnica, hitos, reuniones y plazos clave de CubeSat')
      ).toBeInTheDocument()
    })
  })

  it('renders days of the week in spanish and month navigation controls', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Lun')).toBeInTheDocument()
      expect(screen.getByText('Mar')).toBeInTheDocument()
      expect(screen.getByText('Mié')).toBeInTheDocument()
      expect(screen.getByText('Jue')).toBeInTheDocument()
      expect(screen.getByText('Vie')).toBeInTheDocument()
      expect(screen.getByText('Sáb')).toBeInTheDocument()
      expect(screen.getByText('Dom')).toBeInTheDocument()
    })
  })

  it('loads and displays activities for a selected day (e.g. May 21st, 2026)', async () => {
    renderCalendar()

    // Wait for loaded events/tasks
    await waitFor(() => {
      expect(screen.getByText('Filtros Activos')).toBeInTheDocument()
    })

    // Selected date details (May 21st, 2026 is default selected)
    expect(screen.getByText(/Actividades: 21 de mayo de 2026/i)).toBeInTheDocument()
  })

  it('switches between Month grid view and Agenda list view', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Filtros Activos')).toBeInTheDocument()
    })

    // Toggle agenda view
    const agendaBtn = screen.getByRole('button', { name: 'Agenda' })
    fireEvent.click(agendaBtn)

    // Verify events/deadlines are listed in agenda list
    expect(screen.getByText('Reunión de Coordinación')).toBeInTheDocument()
    expect(screen.getByText('Deadline: Inscripción a CubeDesign 2026')).toBeInTheDocument()

    // Toggle back to Month view
    const monthBtn = screen.getByRole('button', { name: 'Mes' })
    fireEvent.click(monthBtn)
    expect(screen.queryByText('Deadline: Inscripción a CubeDesign 2026')).not.toBeInTheDocument()
  })

  it('filters activities based on event type selection', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Filtros Activos')).toBeInTheDocument()
    })

    // Click Agenda view for easy inspection
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }))

    // Initially shows both reunion and deadlines
    expect(screen.getByText('Reunión de Coordinación')).toBeInTheDocument()
    expect(screen.getByText('Deadline: Inscripción a CubeDesign 2026')).toBeInTheDocument()

    // Change type filter to "reunion"
    const typeSelect = screen.getByTitle('Filtrar por tipo')
    fireEvent.change(typeSelect, { target: { value: 'reunion' } })

    // Reunion should remain, but deadline should be filtered out
    expect(screen.getByText('Reunión de Coordinación')).toBeInTheDocument()
    expect(screen.queryByText('Deadline: Inscripción a CubeDesign 2026')).not.toBeInTheDocument()
  })

  it('filters activities based on source (events only vs tasks only)', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Filtros Activos')).toBeInTheDocument()
    })

    // Click Agenda view
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }))

    // Click 'Tareas' source filter
    const tasksSourceBtn = screen.getByRole('button', { name: 'Tareas' })
    fireEvent.click(tasksSourceBtn)

    // Deadline task should show, reunion event should be filtered out
    expect(screen.getByText('Deadline: Inscripción a CubeDesign 2026')).toBeInTheDocument()
    expect(screen.queryByText('Reunión de Coordinación')).not.toBeInTheDocument()

    // Click 'General' source filter (events only)
    const generalSourceBtn = screen.getByRole('button', { name: 'General' })
    fireEvent.click(generalSourceBtn)

    // Reunion should show, deadline task should be filtered out
    expect(screen.getByText('Reunión de Coordinación')).toBeInTheDocument()
    expect(screen.queryByText('Deadline: Inscripción a CubeDesign 2026')).not.toBeInTheDocument()
  })

  it('only shows "Nueva Actividad" and "Sembrar Tareas" buttons for managers/admins/maestros', async () => {
    // 1. Check with a regular user (not manager, not admin, not maestro)
    currentMockUser = {
      id: 'regular-user',
      email: 'member@usm.cl',
      nombre: 'Pedro',
      apellido: 'Pérez',
      rol: undefined,
      equipos: ['tecnico'],
      createdAt: new Date(),
      isActive: true,
    }

    const { rerender } = render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Calendario de Actividades')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /nueva actividad/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sembrar tareas/i })).not.toBeInTheDocument()

    // 2. Check with a manager
    currentMockUser = {
      id: 'manager-user',
      email: 'mgr@usm.cl',
      nombre: 'Manager',
      rol: undefined,
      equipos: ['manager'],
      createdAt: new Date(),
      isActive: true,
    }

    rerender(
      <MemoryRouter>
        <Calendar key="manager" />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva actividad/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sembrar tareas/i })).toBeInTheDocument()
    })
  })

  it('successfully opens the Add Event modal, validates fields, and creates a new event', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva actividad/i })).toBeInTheDocument()
    })

    // Click 'Nueva Actividad'
    fireEvent.click(screen.getByRole('button', { name: /nueva actividad/i }))

    // Modal forms elements check
    expect(screen.getByText('Título de la Actividad')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ej: Charla Técnica Cubesat')).toBeInTheDocument()

    // Fill title and description
    fireEvent.change(screen.getByPlaceholderText('Ej: Charla Técnica Cubesat'), { target: { value: 'Visita a Casa Central' } })
    fireEvent.change(screen.getByPlaceholderText('Detalles de la reunión, link de zoom, etc...'), { target: { value: 'Visita técnica con profesores' } })

    // Click 'Crear Evento'
    const createBtn = screen.getByRole('button', { name: 'Crear Evento' })
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(mockEventCreate).toHaveBeenCalledTimes(1)
    })

    expect(mockEventCreate).toHaveBeenCalledWith({
      titulo: 'Visita a Casa Central',
      descripcion: 'Visita técnica con profesores',
      fechaInicio: '2026-05-21T20:00:00',
      tipo: 'reunion',
      creadoPor: 'user-manager',
    })
  }, 20000)

  it('allows manager to delete a general event', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Filtros Activos')).toBeInTheDocument()
    })

    // Switch to Agenda view to see the delete button clearly
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }))

    const deleteBtns = screen.getAllByTitle('Eliminar evento')
    expect(deleteBtns.length).toBeGreaterThan(0)

    // Click first delete button
    fireEvent.click(deleteBtns[0])

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(mockEventDelete).toHaveBeenCalledWith('evt-1')
    })
  }, 20000)

  it('runs the meeting task seeder and skips duplicate tasks', async () => {
    renderCalendar()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sembrar tareas/i })).toBeInTheDocument()
    })

    // Click "Sembrar Tareas Reunión (18/05)"
    fireEvent.click(screen.getByRole('button', { name: /sembrar tareas/i }))

    await waitFor(() => {
      // 10 tasks in total. 2 tasks are already in mockTasks (Inscripción and Lectura de bases),
      // so 8 new tasks should be created.
      expect(mockTaskCreate).toHaveBeenCalledTimes(8)
      expect(screen.getByText('¡Importación Completada!')).toBeInTheDocument()
    })
  }, 20000)
})
