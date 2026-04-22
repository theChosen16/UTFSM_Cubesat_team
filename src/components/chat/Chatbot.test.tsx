import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chatbot } from '@/components/chat/Chatbot'

const sendMessageMock = vi.fn()

vi.mock('@/sdk/BotService', () => ({
  BotService: {
    sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  },
}))

describe('Chatbot', () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    sendMessageMock.mockResolvedValue('Respuesta de prueba')
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('opens the dialog and sends a message', async () => {
    const user = userEvent.setup()

    render(<Chatbot />)

    await user.click(screen.getByRole('button', { name: /abrir cubesat ai/i }))

    expect(screen.getByRole('dialog', { name: /cubesat bot/i })).toBeInTheDocument()

    const input = screen.getByPlaceholderText(/envía una consulta táctica/i)
    await user.type(input, 'Estado de la misión')
    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }))

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith('Estado de la misión')
      expect(screen.getByText('Respuesta de prueba')).toBeInTheDocument()
    })
  })
})