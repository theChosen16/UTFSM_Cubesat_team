import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProjectListMock = vi.fn()
const getTaskListMock = vi.fn()
const loggerMock = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}
const getGenerativeModelMock = vi.fn()

vi.mock('@/sdk/ProjectService', () => ({
  ProjectService: {
    getAll: (...args: unknown[]) => getProjectListMock(...args),
  },
}))

vi.mock('@/sdk/TaskService', () => ({
  TaskService: {
    getAll: (...args: unknown[]) => getTaskListMock(...args),
  },
}))

const crearTareaMock = vi.fn()
const crearEventoMock = vi.fn()
const sincronizarProyectoMock = vi.fn()
const obtenerMetricasMock = vi.fn()
const registrarCumpleanosMock = vi.fn()
const gestionarCubeDesignMock = vi.fn()
const auditarActaDriveMock = vi.fn()

vi.mock('@/sdk/AdminActionsService', () => ({
  AdminActionsService: {
    crearTarea: (...args: unknown[]) => crearTareaMock(...args),
    crearEvento: (...args: unknown[]) => crearEventoMock(...args),
    sincronizarProyecto: (...args: unknown[]) => sincronizarProyectoMock(...args),
    obtenerMetricas: (...args: unknown[]) => obtenerMetricasMock(...args),
    registrarCumpleanos: (...args: unknown[]) => registrarCumpleanosMock(...args),
    gestionarCubeDesign: (...args: unknown[]) => gestionarCubeDesignMock(...args),
    auditarActaDrive: (...args: unknown[]) => auditarActaDriveMock(...args),
  }
}))

vi.mock('@/lib/logger', () => ({
  logger: loggerMock,
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function MockGoogleGenerativeAI() {
    return {
      getGenerativeModel: (...args: unknown[]) => getGenerativeModelMock(...args),
    }
  }),
  HarmCategory: {
    HARM_CATEGORY_DANGEROUS_CONTENT: 'danger',
  },
  HarmBlockThreshold: {
    BLOCK_MEDIUM_AND_ABOVE: 'medium',
  },
}))

describe('BotService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    import.meta.env.VITE_GOOGLE_AI_KEY = 'test-google-key'
    getProjectListMock.mockResolvedValue([])
    getTaskListMock.mockResolvedValue([])
    crearTareaMock.mockResolvedValue({ success: true, message: 'Mocked task success' })
    crearEventoMock.mockResolvedValue({ success: true, message: 'Mocked event success' })
    sincronizarProyectoMock.mockResolvedValue({ success: true, message: 'Mocked sync success' })
    obtenerMetricasMock.mockResolvedValue({ success: true, message: 'Mocked metrics success' })
    registrarCumpleanosMock.mockResolvedValue({ success: true, message: 'Mocked birthday success' })
    gestionarCubeDesignMock.mockResolvedValue({ success: true, message: 'Mocked CubeDesign success' })
    auditarActaDriveMock.mockResolvedValue({ success: true, message: 'Mocked Drive audit success' })
  })

  it('falls back to the next Gemini model when the primary one is unavailable', async () => {
    const primarySendMessage = vi.fn().mockRejectedValue(Object.assign(new Error('Model not found'), { status: 404 }))
    const fallbackSendMessage = vi.fn().mockResolvedValue({
      response: {
        text: () => 'Resumen táctico listo.',
        functionCalls: () => undefined
      },
    })

    getGenerativeModelMock.mockImplementation(({ model }: { model: string }) => ({
      startChat: vi.fn(() => ({
        sendMessage: model === 'gemini-2.5-flash' ? primarySendMessage : fallbackSendMessage,
      })),
    }))

    const { BotService } = await import('@/sdk/BotService')

    const response = await BotService.sendMessage('Dame un resumen de los proyectos')

    expect(response).toBe('Resumen táctico listo.')
    expect(getGenerativeModelMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-2.5-flash' }))
    expect(getGenerativeModelMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-flash-latest' }))
  })

  it('securely intercepts and executes function calls for administrators', async () => {
    const firstResponse = {
      response: {
        text: () => 'Iniciando acción ejecutiva...',
        functionCalls: () => [{ name: 'sincronizarProyecto', args: {} }]
      }
    }
    const secondResponse = {
      response: {
        text: () => 'La sincronización orbital de la base de datos se completó con éxito.',
        functionCalls: () => undefined
      }
    }

    const sendMessageMock = vi.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse)

    getGenerativeModelMock.mockImplementation(() => ({
      startChat: vi.fn(() => ({
        sendMessage: sendMessageMock,
      })),
    }))

    const { BotService } = await import('@/sdk/BotService')

    // Reinicia la sesión estática para asegurarse de usar la nueva configuración
    BotService.resetSession()

    const response = await BotService.sendMessage('Sincronizar base de datos del equipo', 'admin-user-id', 'admin')

    expect(response).toBe('La sincronización orbital de la base de datos se completó con éxito.')
    expect(sincronizarProyectoMock).toHaveBeenCalledWith('admin-user-id')
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    
    // El segundo mensaje enviado al modelo debe contener el resultado de la función
    expect(sendMessageMock).toHaveBeenLastCalledWith([
      {
        functionResponse: {
          name: 'sincronizarProyecto',
          response: {
            result: { success: true, message: 'Mocked sync success' }
          }
        }
      }
    ])
  })

  it('correctly executes registrarCumpleanos function call', async () => {
    const firstResponse = {
      response: {
        text: () => 'Registrando cumpleaños...',
        functionCalls: () => [{ name: 'registrarCumpleanos', args: { miembroId: 'user123', fecha: '11-14' } }]
      }
    }
    const secondResponse = {
      response: {
        text: () => 'El cumpleaños de user123 ha sido registrado para el 11-14.',
        functionCalls: () => undefined
      }
    }

    const sendMessageMock = vi.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse)

    getGenerativeModelMock.mockImplementation(() => ({
      startChat: vi.fn(() => ({
        sendMessage: sendMessageMock,
      })),
    }))

    const { BotService } = await import('@/sdk/BotService')
    BotService.resetSession()

    const response = await BotService.sendMessage('Registra el cumpleaños de user123 para el 11-14', 'admin-user-id', 'admin')

    expect(response).toBe('El cumpleaños de user123 ha sido registrado para el 11-14.')
    expect(registrarCumpleanosMock).toHaveBeenCalledWith({ miembroId: 'user123', fecha: '11-14' }, 'admin-user-id')
  })

  it('correctly executes gestionarCubeDesign function call', async () => {
    const firstResponse = {
      response: {
        text: () => 'Gestionando CubeDesign...',
        functionCalls: () => [{ name: 'gestionarCubeDesign', args: { accion: 'crear_hitos' } }]
      }
    }
    const secondResponse = {
      response: {
        text: () => 'Los hitos preparatorios de CubeDesign han sido creados.',
        functionCalls: () => undefined
      }
    }

    const sendMessageMock = vi.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse)

    getGenerativeModelMock.mockImplementation(() => ({
      startChat: vi.fn(() => ({
        sendMessage: sendMessageMock,
      })),
    }))

    const { BotService } = await import('@/sdk/BotService')
    BotService.resetSession()

    const response = await BotService.sendMessage('Crea los hitos de CubeDesign en el calendario', 'admin-user-id', 'admin')

    expect(response).toBe('Los hitos preparatorios de CubeDesign han sido creados.')
    expect(gestionarCubeDesignMock).toHaveBeenCalledWith({ accion: 'crear_hitos' }, 'admin-user-id')
  })

  it('correctly executes auditarActaDrive function call', async () => {
    const firstResponse = {
      response: {
        text: () => 'Procesando acta de Drive...',
        functionCalls: () => [{ name: 'auditarActaDrive', args: { fechaActa: '2026-05-18', acuerdosResumen: '- Tarea 1\n- Tarea 2' } }]
      }
    }
    const secondResponse = {
      response: {
        text: () => 'El acta ha sido procesada con éxito y se crearon las tareas.',
        functionCalls: () => undefined
      }
    }

    const sendMessageMock = vi.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse)

    getGenerativeModelMock.mockImplementation(() => ({
      startChat: vi.fn(() => ({
        sendMessage: sendMessageMock,
      })),
    }))

    const { BotService } = await import('@/sdk/BotService')
    BotService.resetSession()

    const response = await BotService.sendMessage('Audita el acta del 18 de mayo del Drive', 'admin-user-id', 'admin')

    expect(response).toBe('El acta ha sido procesada con éxito y se crearon las tareas.')
    expect(auditarActaDriveMock).toHaveBeenCalledWith({ fechaActa: '2026-05-18', acuerdosResumen: '- Tarea 1\n- Tarea 2' }, 'admin-user-id')
  })
})