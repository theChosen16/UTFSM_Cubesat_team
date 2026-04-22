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
  })

  it('falls back to the next Gemini model when the primary one is unavailable', async () => {
    const primarySendMessage = vi.fn().mockRejectedValue(Object.assign(new Error('Model not found'), { status: 404 }))
    const fallbackSendMessage = vi.fn().mockResolvedValue({
      response: {
        text: () => 'Resumen táctico listo.',
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
    expect(primarySendMessage).toHaveBeenCalledWith('Dame un resumen de los proyectos')
    expect(fallbackSendMessage).toHaveBeenCalledWith('Dame un resumen de los proyectos')
  })
})