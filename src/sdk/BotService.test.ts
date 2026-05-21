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

vi.mock('@/sdk/AdminActionsService', () => ({
  AdminActionsService: {
    crearTarea: (...args: unknown[]) => crearTareaMock(...args),
    crearEvento: (...args: unknown[]) => crearEventoMock(...args),
    sincronizarProyecto: (...args: unknown[]) => sincronizarProyectoMock(...args),
    obtenerMetricas: (...args: unknown[]) => obtenerMetricasMock(...args),
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
})