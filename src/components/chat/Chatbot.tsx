import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, User as UserIcon, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { BotService } from '@/sdk/BotService'

interface Message {
  role: 'user' | 'model'
  content: string
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: '¡Hola! Soy Cubesat Bot, el núcleo táctico de inteligencia del equipo USM Cubesat.\n\nEstoy aquí para mantenerte enfocado en la misión, asistir con análisis ingenieril y revisar el contexto crítico de nuestros proyectos espaciales. ¿En qué parámetro te asisto hoy?'
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)

  // Scroll al ultimo mensaje automáticamente
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isTyping) return

    const userMessage = input.trim()
    setInput('')
    
    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsTyping(true)

    // Llamar motor del BotService
    const aiResponse = await BotService.sendMessage(userMessage)

    setMessages(prev => [...prev, { role: 'model', content: aiResponse }])
    setIsTyping(false)
  }

  return (
    <>
      {/* Botón flotante para abrir chat */}
      <button
        onClick={() => setIsOpen(true)}
        title="Abrir Cubesat AI"
        aria-label="Abrir Cubesat AI"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="cubesat-chat"
        className={`fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:scale-110 hover:bg-cyan-500 sm:bottom-6 sm:right-6 ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <Bot size={28} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Ventana de Chat Flotante */}
      <div 
        id="cubesat-chat"
        role="dialog"
        aria-modal={isOpen}
        aria-label="Cubesat Bot"
        style={{ maxHeight: 'calc(100dvh - 1.5rem)' }}
        className={`mobile-safe-bottom fixed inset-x-3 bottom-3 z-50 flex h-[min(70vh,34rem)] min-h-[22rem] flex-col rounded-[1.75rem] border border-space-600 bg-space-800/95 shadow-2xl backdrop-blur-xl transition-all duration-300 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[550px] sm:w-[380px] sm:max-w-[calc(100vw-3rem)] sm:rounded-2xl sm:origin-bottom-right ${isOpen ? 'translate-y-0 opacity-100 sm:scale-100' : 'pointer-events-none translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95'}`}
      >
        {/* Cabecera del Bot */}
        <div className="rounded-t-[1.75rem] border-b border-space-600 bg-space-900/50 px-4 py-3.5 sm:rounded-t-2xl">
          <div className="mb-3 flex justify-center sm:hidden">
            <span className="h-1.5 w-12 rounded-full bg-space-600" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-cyan-500/20">
              <Bot className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Cubesat Bot</h3>
              <p className="text-xs text-cyan-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Sistemas online
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground hover:text-white"
            aria-label="Cerrar Cubesat Bot"
          >
            <X size={20} />
          </Button>
          </div>
        </div>

        {/* Zona de Mensajes */}
        <div className="touch-scroll flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-thin scrollbar-thumb-space-600 scrollbar-track-transparent sm:p-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-purple-500/20 text-white rounded-tr-sm' : 'bg-space-700/80 text-gray-200 rounded-tl-sm'}`}>
                {msg.role === 'user' ? (
                  <p>{msg.content}</p>
                ) : (
                  <div className="prose prose-invert prose-p:leading-snug prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 bg-cyan-500/20 text-cyan-400">
                <Bot size={16} />
              </div>
              <div className="p-3 rounded-2xl bg-space-700/80 text-gray-200 rounded-tl-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-cyan-400" />
                <span className="text-sm animate-pulse">Analizando variables...</span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input box */}
        <div className="mobile-safe-bottom rounded-b-[1.75rem] border-t border-space-600 bg-space-900/50 p-3 sm:rounded-b-2xl">
          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Envía una consulta táctica..."
              disabled={isTyping}
              className="min-h-11 flex-1 bg-space-700 border border-space-600 rounded-xl px-4 py-2.5 text-base text-white placeholder-muted-foreground focus:outline-none focus:border-cyan-500 disabled:opacity-50 sm:text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              aria-label="Enviar mensaje"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-white transition-colors hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600"
            >
              <Send size={18} className="translate-x-0.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
