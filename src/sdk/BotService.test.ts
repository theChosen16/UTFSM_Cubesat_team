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
const obtenerEstadoNoticiarioMock = vi.fn()
const forzarEnvioNoticiarioMock = vi.fn()

vi.mock('@/sdk/AdminActionsService', () => ({
  AdminActionsService: {
    crearTarea: (...args: unknown[]) => crearTareaMock(...args),
    crearEvento: (...args: unknown[]) => crearEventoMock(...args),
    sincronizarProyecto: (...args: unknown[]) => sincronizarProyectoMock(...args),
    obtenerMetricas: (...args: unknown[]) => obtenerMetricasMock(...args),
    registrarCumpleanos: (...args: unknown[]) => registrarCumpleanosMock(...args),
    gestionarCubeDesign: (...args: unknown[]) => gestionarCubeDesignMock(...args),
    auditarActaDrive: (...args: unknown[]) => auditarActaDriveMock(...args),
    obtenerEstadoNoticiario: (...args: unknown[]) => obtenerEstadoNoticiarioMock(...args),
    forzarEnvioNoticiario: (...args: unknown[]) => forzarEnvioNoticiarioMock(...args),
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
    import.meta.env.DEV = true
    import.meta.env.VITE_ENABLE_DIRECT_AI = 'true'
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
    obtenerEstadoNoticiarioMock.mockResolvedValue({ success: true, message: 'Mocked newsletter status success' })
    forzarEnvioNoticiarioMock.mockResolvedValue({ success: true, message: 'Mocked newsletter forced success' })
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
        sendMessage: model === 'gemini-3.5-flash' ? primarySendMessage : fallbackSendMessage,
      })),
    }))

    const { BotService } = await import('@/sdk/BotService')

    const response = await BotService.sendMessage('Dame un resumen de los proyectos')

    expect(response).toBe('Resumen táctico listo.')
    expect(getGenerativeModelMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.5-flash' }))
    expect(getGenerativeModelMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-2.5-flash' }))
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

  it('correctly executes obtenerEstadoNoticiario function call', async () => {
    const firstResponse = {
      response: {
        text: () => 'Consultando el estado del noticiario...',
        functionCalls: () => [{ name: 'obtenerEstadoNoticiario', args: {} }]
      }
    }
    const secondResponse = {
      response: {
        text: () => 'El último noticiario fue enviado hace 2 días.',
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

    const response = await BotService.sendMessage('Dime el estado del noticiario semanal', 'admin-user-id', 'admin')

    expect(response).toBe('El último noticiario fue enviado hace 2 días.')
    expect(obtenerEstadoNoticiarioMock).toHaveBeenCalled()
  })

  it('correctly executes forzarEnvioNoticiario function call', async () => {
    const firstResponse = {
      response: {
        text: () => 'Despachando noticiario semanal...',
        functionCalls: () => [{ name: 'forzarEnvioNoticiario', args: {} }]
      }
    }
    const secondResponse = {
      response: {
        text: () => 'Noticiario enviado exitosamente a todos.',
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

    const response = await BotService.sendMessage('Envía el noticiario semanal ahora mismo', 'admin-user-id', 'admin')

    expect(response).toBe('Noticiario enviado exitosamente a todos.')
    expect(forzarEnvioNoticiarioMock).toHaveBeenCalledWith('admin-user-id')
  })

  it('correctly sends inlineData (images/PDFs) to Gemini', async () => {
    const sendMessageMock = vi.fn().mockResolvedValue({
      response: {
        text: () => 'He analizado el archivo PDF que enviaste.',
        functionCalls: () => undefined
      }
    })

    getGenerativeModelMock.mockImplementation(() => ({
      startChat: vi.fn(() => ({
        sendMessage: sendMessageMock,
      })),
    }))

    const { BotService } = await import('@/sdk/BotService')
    BotService.resetSession()

    const fileData = {
      name: 'documento.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      inlineData: {
        data: 'base64encodedpdfcontent',
        mimeType: 'application/pdf'
      }
    }

    const response = await BotService.sendMessage(
      '¿Qué dice el documento?',
      'admin-user-id',
      'admin',
      fileData
    )

    expect(response).toBe('He analizado el archivo PDF que enviaste.')
    expect(sendMessageMock).toHaveBeenCalledWith([
      {
        inlineData: {
          data: 'base64encodedpdfcontent',
          mimeType: 'application/pdf'
        }
      },
      '¿Qué dice el documento?'
    ])
  })

  it('correctly handles and injects extractedText (Word/PPTX/Text) into the prompt', async () => {
    const sendMessageMock = vi.fn().mockResolvedValue({
      response: {
        text: () => 'He procesado el archivo Word adjunto.',
        functionCalls: () => undefined
      }
    })

    getGenerativeModelMock.mockImplementation(() => ({
      startChat: vi.fn(() => ({
        sendMessage: sendMessageMock,
      })),
    }))

    const { BotService } = await import('@/sdk/BotService')
    BotService.resetSession()

    const fileData = {
      name: 'acta.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 2048,
      extractedText: 'Acuerdos de la reunion: Tarea 1 para tecnico. Tarea 2 para PR.'
    }

    const response = await BotService.sendMessage(
      'Resume las tareas del acta',
      'admin-user-id',
      'admin',
      fileData
    )

    expect(response).toBe('He procesado el archivo Word adjunto.')
    const expectedPrompt = `[DOCUMENTO ADJUNTO: "acta.docx"]\n---\nAcuerdos de la reunion: Tarea 1 para tecnico. Tarea 2 para PR.\n---\n\nConsulta sobre el documento: Resume las tareas del acta`
    expect(sendMessageMock).toHaveBeenCalledWith(expectedPrompt)
  })

  describe('Proxy Mode', () => {
    let fetchMock: any

    beforeEach(() => {
      import.meta.env.VITE_GOOGLE_AI_KEY = 'your-google-ai-key' // Force proxy mode
      import.meta.env.VITE_DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/proxy-url/exec'
      import.meta.env.VITE_DRIVE_UPLOAD_SECRET = 'mock-shared-secret'

      fetchMock = vi.fn()
      global.fetch = fetchMock
    })

    it('correctly sends user messages via Google Apps Script proxy', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Hola, soy Cubesat Bot por Proxy.' }
                ]
              }
            }
          ]
        })
      })

      const { BotService } = await import('@/sdk/BotService')
      BotService.resetSession()

      const response = await BotService.sendMessage('Hola Bot', 'user-id', 'admin')

      expect(response).toBe('Hola, soy Cubesat Bot por Proxy.')
      expect(fetchMock).toHaveBeenCalledWith('https://script.google.com/macros/s/proxy-url/exec', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }))
    })

    it('handles function calling over proxy recursively', async () => {
      const firstResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  functionCall: {
                    name: 'sincronizarProyecto',
                    args: {}
                  }
                }
              ]
            }
          }
        ]
      }

      const secondResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'Sincronización completada vía proxy.' }
              ]
            }
          }
        ]
      }

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => firstResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => secondResponse
        })

      const { BotService } = await import('@/sdk/BotService')
      BotService.resetSession()

      const response = await BotService.sendMessage('Sincroniza la base de datos', 'admin-id', 'admin')

      expect(response).toBe('Sincronización completada vía proxy.')
      expect(sincronizarProyectoMock).toHaveBeenCalledWith('admin-id')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})