import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAllEventsMock = vi.fn()
const getAllTasksMock = vi.fn()
const getAllUsersMock = vi.fn()
const addDocMock = vi.fn()
const getDocsMock = vi.fn()
const createActivityMock = vi.fn()

vi.mock('@/sdk/EventService', () => ({
  EventService: {
    getAll: (...args: unknown[]) => getAllEventsMock(...args),
  },
}))

vi.mock('@/sdk/TaskService', () => ({
  TaskService: {
    getAll: (...args: unknown[]) => getAllTasksMock(...args),
  },
}))

vi.mock('@/sdk/UserService', () => ({
  UserService: {
    getAll: (...args: unknown[]) => getAllUsersMock(...args),
  },
}))

vi.mock('@/sdk/ActivityLogService', () => ({
  ActivityLogService: {
    create: (...args: unknown[]) => createActivityMock(...args),
  },
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  Timestamp: {
    now: () => ({ toMillis: () => Date.now() }),
    fromDate: (date: Date) => ({ toDate: () => date }),
  },
  orderBy: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

describe('EmailNotificationService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getAllEventsMock.mockResolvedValue([])
    getAllTasksMock.mockResolvedValue([])
    getAllUsersMock.mockResolvedValue([])
    addDocMock.mockResolvedValue({ id: 'new-doc-id' })
    getDocsMock.mockResolvedValue({ empty: true, docs: [] })
    createActivityMock.mockResolvedValue({ id: 'activity-id' })
  })

  it('compiles digest data correctly into upcoming, completed, in-progress and new tasks', async () => {
    const now = new Date()
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()

    getAllEventsMock.mockResolvedValue([
      { id: 'ev1', titulo: 'Upcoming Event', fechaInicio: threeDaysAhead, tipo: 'reunion' },
      { id: 'ev2', titulo: 'Old Event', fechaInicio: fiveDaysAgo, tipo: 'visita' },
    ])

    getAllTasksMock.mockResolvedValue([
      { id: 't1', titulo: 'Completed Task', estado: 'completado', completedAt: fiveDaysAgo, createdAt: fiveDaysAgo, asignadoA: ['u1'] },
      { id: 't2', titulo: 'In Progress Task', estado: 'en_progreso', createdAt: fiveDaysAgo, asignadoA: ['u2'] },
      { id: 't3', titulo: 'New Task', estado: 'sin_iniciar', createdAt: fiveDaysAgo, asignadoA: [] },
    ])

    const { EmailNotificationService } = await import('@/sdk/EmailNotificationService')
    const data = await EmailNotificationService.compileDigestData()

    expect(data.upcomingEvents).toHaveLength(1)
    expect(data.upcomingEvents[0].titulo).toBe('Upcoming Event')

    expect(data.completedTasks).toHaveLength(1)
    expect(data.completedTasks[0].titulo).toBe('Completed Task')

    expect(data.inProgressTasks).toHaveLength(1)
    expect(data.inProgressTasks[0].titulo).toBe('In Progress Task')

    expect(data.newTasks).toHaveLength(3) // All created in the last 7 days are categorized as new tasks
  })

  it('generates HTML templates styled beautifully', async () => {
    const { EmailNotificationService } = await import('@/sdk/EmailNotificationService')
    
    const events = [
      { id: 'ev1', titulo: 'Diseño Térmico', fechaInicio: new Date().toISOString(), tipo: 'deadline', creadoPor: 'admin', createdAt: new Date() }
    ]
    const completed = [
      { id: 't1', titulo: 'Verificar telemetría', estado: 'completado', equipo: 'tecnico', asignadoA: [] }
    ]
    const inProgress = [
      { id: 't2', titulo: 'Programación Firmware', estado: 'en_progreso', equipo: 'tecnico', asignadoA: ['u1', 'u2'] }
    ]
    const newTasks = [
      { id: 't3', titulo: 'Redes Sociales', estado: 'sin_iniciar', equipo: 'relaciones_publicas', asignadoA: [] }
    ]

    const html = EmailNotificationService.generateHTMLTemplate('Constanza', {
      upcomingEvents: events as any,
      completedTasks: completed as any,
      inProgressTasks: inProgress as any,
      newTasks: newTasks as any
    })

    expect(html).toContain('Constanza')
    expect(html).toContain('Diseño Térmico')
    expect(html).toContain('Verificar telemetría')
    expect(html).toContain('Programación Firmware')
    expect(html).toContain('BOLETÍN SEMANAL CUBESAT')
  })

  it('escapes untrusted event fields, including the date, before they reach the mailed HTML', async () => {
    // `fechaInicio` is written verbatim by AdminActionsService.auditarActaDrive from text the
    // model derived from an uploaded minute, so it is attacker-influenceable, and it was the
    // one event field interpolated into this template without escaping.
    const { EmailNotificationService } = await import('@/sdk/EmailNotificationService')

    const payload = '"><img src=x onerror=alert(1)>'
    const html = EmailNotificationService.generateHTMLTemplate('Constanza', {
      upcomingEvents: [
        {
          id: 'ev1',
          titulo: payload,
          descripcion: payload,
          fechaInicio: payload,
          tipo: 'reunion',
          creadoPor: 'admin',
          createdAt: new Date(),
        },
      ] as any,
      completedTasks: [] as any,
      inProgressTasks: [] as any,
      newTasks: [] as any,
    })

    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('sends weekly digest to all active users', async () => {
    const { EmailNotificationService } = await import('@/sdk/EmailNotificationService')

    getAllUsersMock.mockResolvedValue([
      { id: 'u1', nombre: 'Ignacio', email: 'ignacio@usm.cl', isActive: true },
      { id: 'u2', nombre: 'Javiera', email: 'test.notif@sansano.usm.cl', isActive: true },
      { id: 'u3', nombre: 'Inactivo', email: 'inactivo@usm.cl', isActive: false },
    ])

    getAllEventsMock.mockResolvedValue([])
    getAllTasksMock.mockResolvedValue([])

    const result = await EmailNotificationService.sendWeeklyDigest('admin-actor')

    expect(result.recipientCount).toBe(2)
    expect(result.triggeredBy).toBe('admin-actor')
    expect(result.recipients).toContain('ignacio@usm.cl')
    expect(result.recipients).toContain('test.notif@sansano.usm.cl')
    expect(result.recipients).not.toContain('inactivo@usm.cl')

    // Added 2 emails to /mail collection + 1 log to /mail_digests = 3 addDocs
    expect(addDocMock).toHaveBeenCalledTimes(3)
    expect(createActivityMock).toHaveBeenCalled()
  })

  it('refuses to send weekly digest if no active users are found', async () => {
    const { EmailNotificationService } = await import('@/sdk/EmailNotificationService')

    getAllUsersMock.mockResolvedValue([])

    await expect(EmailNotificationService.sendWeeklyDigest('admin-actor')).rejects.toThrow(
      'No hay usuarios activos registrados con correo electrónico.'
    )
  })

  it('runs daemon check and triggers digest when 7 days have passed since last dispatch', async () => {
    const { EmailNotificationService } = await import('@/sdk/EmailNotificationService')

    getAllUsersMock.mockResolvedValue([
      { id: 'u1', nombre: 'Ignacio', email: 'ignacio@usm.cl', isActive: true },
    ])

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    getDocsMock.mockResolvedValue({
      empty: false,
      docs: [{
        id: 'log1',
        data: () => ({
          createdAt: { toDate: () => eightDaysAgo },
          triggeredBy: 'admin',
          recipientCount: 1,
        })
      }]
    })

    const triggered = await EmailNotificationService.checkAndTriggerWeeklyDigest('admin')
    expect(triggered).toBe(true)
    expect(addDocMock).toHaveBeenCalled() // Sent
  })

  it('runs daemon check and does NOT trigger digest when less than 7 days have passed', async () => {
    const { EmailNotificationService } = await import('@/sdk/EmailNotificationService')

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    getDocsMock.mockResolvedValue({
      empty: false,
      docs: [{
        id: 'log1',
        data: () => ({
          createdAt: { toDate: () => twoDaysAgo },
          triggeredBy: 'admin',
          recipientCount: 1,
        })
      }]
    })

    const triggered = await EmailNotificationService.checkAndTriggerWeeklyDigest('admin')
    expect(triggered).toBe(false)
    expect(addDocMock).not.toHaveBeenCalled() // Not sent
  })

  it('returns last log correctly in getLastDigestLog', async () => {
    const { EmailNotificationService } = await import('@/sdk/EmailNotificationService')

    const logDate = new Date()
    getDocsMock.mockResolvedValue({
      empty: false,
      docs: [{
        id: 'logId123',
        data: () => ({
          createdAt: { toDate: () => logDate },
          triggeredBy: 'admin_test',
          recipientCount: 5,
          eventsCount: 3,
          tasksCount: 10,
          recipients: ['a@usm.cl', 'b@usm.cl'],
        })
      }]
    })

    const log = await EmailNotificationService.getLastDigestLog()
    expect(log).not.toBeNull()
    expect(log!.id).toBe('logId123')
    expect(log!.triggeredBy).toBe('admin_test')
    expect(log!.recipientCount).toBe(5)
    expect(log!.eventsCount).toBe(3)
    expect(log!.tasksCount).toBe(10)
    expect(log!.recipients).toEqual(['a@usm.cl', 'b@usm.cl'])
  })
})
