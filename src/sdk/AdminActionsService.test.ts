import { beforeEach, describe, expect, it, vi } from 'vitest'

const createTaskMock = vi.fn()
const createEventMock = vi.fn()
const createActivityMock = vi.fn()

vi.mock('./TaskService', () => ({
  TaskService: {
    create: (...args: unknown[]) => createTaskMock(...args),
    getAll: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('./EventService', () => ({
  EventService: {
    create: (...args: unknown[]) => createEventMock(...args),
  },
}))

vi.mock('./ProjectService', () => ({
  ProjectService: { getAll: vi.fn().mockResolvedValue([]) },
}))

vi.mock('./UserService', () => ({
  UserService: { getAll: vi.fn().mockResolvedValue([]) },
}))

vi.mock('./EmailNotificationService', () => ({
  EmailNotificationService: {
    getLastDigestLog: vi.fn().mockResolvedValue(null),
    sendWeeklyDigest: vi.fn().mockResolvedValue({ recipientCount: 0 }),
  },
}))

vi.mock('./ActivityLogService', () => ({
  ActivityLogService: {
    create: (...args: unknown[]) => createActivityMock(...args),
  },
}))

vi.mock('@/lib/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

/**
 * `auditarActaDrive` materializa texto proveniente del modelo (a menudo derivado de un documento
 * adjunto no confiable) como un documento de Firestore POR LÍNEA. Sin cotas, un acta manipulada
 * se convierte en una amplificación de escrituras ilimitada sobre el espacio compartido.
 */
describe('AdminActionsService.auditarActaDrive — cotas anti-amplificación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createTaskMock.mockResolvedValue('task-id')
    createEventMock.mockResolvedValue('event-id')
    createActivityMock.mockResolvedValue('log-id')
  })

  it('acota el número total de documentos creados por un acta manipulada', async () => {
    const { AdminActionsService } = await import('./AdminActionsService')

    // 500 acuerdos accionables: sin la cota se crearían 500 documentos en Firestore.
    const acuerdosResumen = Array.from(
      { length: 500 },
      (_, i) => `- Preparar el subsistema numero ${i} para la mision`
    ).join('\n')

    const result = await AdminActionsService.auditarActaDrive(
      { fechaActa: '2026-01-15', acuerdosResumen },
      'admin-user-id'
    )

    const totalCreated = createTaskMock.mock.calls.length + createEventMock.mock.calls.length

    expect(result.success).toBe(true)
    expect(totalCreated).toBe(40)
    expect(result.data?.truncatedByLimit).toBe(true)
    expect(result.message).toContain('límite de seguridad')
  })

  it('trunca la entrada antes de procesarla para acotar el coste del parseo', async () => {
    const { AdminActionsService } = await import('./AdminActionsService')

    // Una única línea gigantesca: se recorta a ACTA_MAX_INPUT_CHARS (20 000) antes de parsear,
    // de modo que el título/descripcion derivados nunca crecen sin control.
    const acuerdosResumen = 'Revisar el arnes de cableado '.repeat(5000)

    const result = await AdminActionsService.auditarActaDrive(
      { fechaActa: '2026-01-15', acuerdosResumen },
      'admin-user-id'
    )

    expect(result.success).toBe(true)
    expect(createTaskMock).toHaveBeenCalledTimes(1)
    const [taskData] = createTaskMock.mock.calls[0]
    expect(taskData.descripcion.length).toBeLessThan(20500)
  })

  it('procesa con normalidad un acta de tamaño legítimo', async () => {
    const { AdminActionsService } = await import('./AdminActionsService')

    const result = await AdminActionsService.auditarActaDrive(
      {
        fechaActa: '2026-01-15',
        acuerdosResumen: [
          '- Coordinar el presupuesto de la mision',
          '- Agendar reunion de subsistema termico el 20 de marzo',
        ].join('\n'),
      },
      'admin-user-id'
    )

    expect(result.success).toBe(true)
    expect(result.data?.truncatedByLimit).toBe(false)
    expect(createTaskMock).toHaveBeenCalledTimes(1)
    expect(createEventMock).toHaveBeenCalledTimes(1)
  })
})
