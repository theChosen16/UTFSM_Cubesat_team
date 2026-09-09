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

/**
 * Los argumentos de las herramientas ejecutivas los redacta el MODELO, no la persona: llegan de
 * una respuesta de Gemini que pudo ser influida por el contenido de un documento adjunto. Estas
 * dos acciones son además las únicas que escriben en el documento de OTRO usuario, así que sus
 * identificadores y valores se validan antes de tocar Firestore.
 */
describe('AdminActionsService — validación de argumentos generados por el modelo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createActivityMock.mockResolvedValue('log-id')
  })

  it('rechaza un miembroId que no es un identificador de documento', async () => {
    const { AdminActionsService } = await import('./AdminActionsService')
    const { getDoc, setDoc } = await import('firebase/firestore')

    // `doc(db, 'users', id)` une los segmentos con '/', de modo que un valor con barras apunta a
    // una ruta distinta de la pretendida.
    for (const miembroId of ['abc/def/ghi', '../admin', '', 'x'.repeat(129)]) {
      const result = await AdminActionsService.registrarCumpleanos(
        { miembroId, fecha: '11-14' },
        'admin-user-id'
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('identificador de miembro no es válido')
    }

    expect(getDoc).not.toHaveBeenCalled()
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('rechaza una fecha de cumpleaños fuera del formato declarado', async () => {
    const { AdminActionsService } = await import('./AdminActionsService')
    const { setDoc } = await import('firebase/firestore')

    for (const fecha of ['no-es-una-fecha', '13-01', '11-32', 'A'.repeat(500)]) {
      const result = await AdminActionsService.registrarCumpleanos(
        { miembroId: 'abc123', fecha },
        'admin-user-id'
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('formato MM-DD')
    }

    expect(setDoc).not.toHaveBeenCalled()
  })

  it('acepta los formatos legítimos y sigue adelante hasta Firestore', async () => {
    const { AdminActionsService } = await import('./AdminActionsService')
    const { getDoc } = await import('firebase/firestore')

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ nombre: 'Sofía' }),
    } as unknown as Awaited<ReturnType<typeof getDoc>>)

    for (const fecha of ['11-14', '2026-11-14']) {
      const result = await AdminActionsService.registrarCumpleanos(
        { miembroId: 'abc123', fecha },
        'admin-user-id'
      )
      expect(result.success).toBe(true)
    }
  })

  it('rechaza un miembroId inválido también en gestionarCubeDesign', async () => {
    const { AdminActionsService } = await import('./AdminActionsService')
    const { setDoc } = await import('firebase/firestore')

    const result = await AdminActionsService.gestionarCubeDesign(
      { accion: 'confirmar_miembro', miembroId: 'users/otro/subcoleccion/doc' },
      'admin-user-id'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('identificador de miembro no es válido')
    expect(setDoc).not.toHaveBeenCalled()
  })
})
