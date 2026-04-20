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
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500 hover:scale-110 transition-all duration-300 ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <Bot size={28} />
      </button>

      {/* Ventana de Chat Flotante */}
      <div 
        className={`fixed bottom-6 right-6 w-[380px] h-[550px] max-w-[calc(100vw-3rem)] bg-space-800/95 backdrop-blur-xl border border-space-600 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Cabecera del Bot */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-space-600 bg-space-900/50 rounded-t-2xl">
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
          >
            <X size={20} />
          </Button>
        </div>

        {/* Zona de Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-space-600 scrollbar-track-transparent">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
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
        <div className="p-3 border-t border-space-600 bg-space-900/50 rounded-b-2xl">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Envía una consulta táctica..."
              disabled={isTyping}
              className="flex-1 bg-space-700 border border-space-600 rounded-xl px-4 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="p-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 transition-colors"
            >
              <Send size={18} className="translate-x-0.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
