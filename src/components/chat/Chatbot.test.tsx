import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { Chatbot } from '@/components/chat/Chatbot'

const sendMessageMock = vi.fn()

vi.mock('@/sdk/BotService', () => ({
  BotService: {
    sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  },
}))

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: 'user-id', nombre: 'Test User', rol: 'member', equipos: [] }
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser
  })
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  analytics: null,
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}))


describe('Chatbot', () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    sendMessageMock.mockResolvedValue('Respuesta de prueba')
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('opens the dialog and sends a message', async () => {
    render(<Chatbot />)

    fireEvent.click(screen.getByRole('button', { name: /abrir cubesat ai/i }))

    expect(screen.getByRole('dialog', { name: /cubesat bot/i })).toBeInTheDocument()

    const input = screen.getByPlaceholderText(/envía una consulta táctica/i)
    fireEvent.change(input, { target: { value: 'Estado de la misión' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }))

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith('Estado de la misión', 'user-id', 'member', null)
      expect(screen.getByText('Respuesta de prueba')).toBeInTheDocument()
    })
  })
})