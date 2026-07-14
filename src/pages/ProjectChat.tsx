import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ProjectChatService } from '@/sdk/ProjectChatService'
import { UserService } from '@/sdk/UserService'
import { ProjectService } from '@/sdk/ProjectService'
import { ProjectMessage, User } from '@/types'
import { extractNameFromEmail, sanitizeUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Send, ArrowLeft, Paperclip, MoreHorizontal, Edit2, Trash2, File, Bot, AlertTriangle } from 'lucide-react'

const MAX_FILE_SIZE_BYTES = 500 * 1024 // 500KB — base64 inflates ~33%, keeping under Firestore 1MB doc limit
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logger } from '@/lib/logger'

export default function ProjectChat() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, User>>({})
  const [projectName, setProjectName] = useState('Cargando...')
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (!projectId) return

    const loadData = async () => {
      try {
        const [projects, users] = await Promise.all([
          ProjectService.getAll(),
          UserService.getAll()
        ])
        const proj = projects.find(p => p.id === projectId)
        if (proj) setProjectName(proj.nombre)
        else setProjectName('Proyecto no encontrado')

        const map: Record<string, User> = {}
        users.forEach(u => { map[u.id] = u })
        setUsersMap(map)
      } catch (error) {
        logger.error('Error loading project chat init data', { error })
      }
    }

    loadData()

    const unsubscribe = ProjectChatService.subscribeToMessages(projectId, (newMessages) => {
      setMessages(newMessages)
      setLoading(false)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })

    return () => unsubscribe()
  }, [projectId])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileError(null)

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`El archivo es demasiado grande (${(file.size / 1024).toFixed(0)}KB). Máximo permitido: ${MAX_FILE_SIZE_BYTES / 1024}KB.`)
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setFileUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !fileUrl) || !projectId || !user || isSubmitting) return
    setIsSubmitting(true)
    setSendError(null)
    try {
      await ProjectChatService.sendMessage({
        projectId,
        senderId: user.id,
        content: newMessage.trim(),
        fileUrls: fileUrl ? [fileUrl] : [],
        isAiOrchestrated: false // Normal message by user
      })
      setNewMessage('')
      setFileUrl('')
      setFileError(null)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (error) {
      logger.error('Error sending project message', { error })
      setSendError('Error al enviar el mensaje. El archivo puede ser demasiado grande.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditMessage = async (msgId: string) => {
    if (!editContent.trim()) return
    try {
      await ProjectChatService.updateMessage(msgId, editContent)
      setEditingId(null)
    } catch (error) {
      logger.error('Error editing project message', { error })
    }
  }

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await ProjectChatService.deleteMessage(msgId)
    } catch (error) {
      logger.error('Error deleting project message', { error })
    }
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  if (loading) {
    return <Spinner className="min-h-[50vh]" />
  }

  return (
    <div className="page-shell max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)] h-[calc(100dvh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-space-600 mb-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="text-muted-foreground hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white leading-none mb-1">Chat: {projectName}</h1>
          <p className="text-sm text-cyan-400">Coordinación y base de datos orquestada</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 touch-scroll custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>No hay mensajes en este chat todavía.</p>
            <p className="text-sm mt-1">¡Sé el primero en saludar o enviar un avance!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === user?.id
            const isAi = msg.isAiOrchestrated
            const authorUser = usersMap[msg.senderId]
            const displayName = isAi ? 'AI Orquestador' : authorUser?.nombre ? `${authorUser.nombre} ${authorUser.apellido || ''}`.trim() : extractNameFromEmail(authorUser?.email || 'Usuario')
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                <span className="text-xs text-muted-foreground mb-1 ml-1 mr-1">{displayName}</span>
                
                <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[70%]">
                  {!isMe && !isAi && (
                    <div className="w-8 h-8 rounded-full bg-space-600 flex items-center justify-center text-xs font-bold shrink-0 text-white overflow-hidden mb-1">
                      {authorUser?.photoURL ? <img src={authorUser.photoURL} alt={displayName} className="w-full h-full object-cover" /> : displayName.charAt(0)}
                    </div>
                  )}
                  {isAi && (
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mb-1">
                      <Bot className="w-5 h-5 text-purple-400" />
                    </div>
                  )}
                  
                  <div className={`relative px-4 py-2 rounded-2xl ${isMe ? 'bg-cyan-500 text-space-900 rounded-br-sm' : isAi ? 'bg-purple-500/10 border border-purple-500/20 text-white rounded-bl-sm' : 'bg-space-700 text-white rounded-bl-sm'}`}>
                    
                    {editingId === msg.id ? (
                      <div className="min-w-[200px]">
                        <Textarea 
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="bg-space-800 text-white border-space-600 mb-2 min-h-[60px]"
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancelar</Button>
                          <Button size="sm" onClick={() => handleEditMessage(msg.id)} className="h-7 text-xs bg-cyan-600">Guardar</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-sm break-words">{msg.content}</p>
                        {msg.fileUrls && msg.fileUrls.map((url, idx) => {
                          const isImage = url.startsWith('data:image') || url.match(/\.(jpeg|jpg|gif|png)$/) != null
                          // `fileUrls` proviene del documento del mensaje (escribible por cualquier
                          // miembro): se sanea antes de usarlo en un `href` para evitar XSS
                          // (javascript:, etc.). Las data:image se mantienen sólo como <img>.
                          const safeUrl = isImage ? undefined : sanitizeUrl(url)
                          return (
                            <div key={idx} className="mt-2 rounded-lg overflow-hidden max-w-full">
                              {isImage ? (
                                <img src={url} alt="Attachment" className="max-h-60 object-contain rounded" />
                              ) : safeUrl ? (
                                <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs bg-black/20 p-2 rounded hover:bg-black/30">
                                  <File className="w-4 h-4" /> Archivo adjunto
                                </a>
                              ) : (
                                <span className="flex items-center gap-2 text-xs bg-black/20 p-2 rounded text-muted-foreground">
                                  <File className="w-4 h-4" /> Archivo adjunto
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                    
                    {!editingId && isMe && (
                      <div className="absolute top-0 right-0 -mr-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-space-800 border-space-600 min-w-32">
                            <DropdownMenuItem onClick={() => { setEditingId(msg.id); setEditContent(msg.content) }} className="text-white hover:bg-space-700 cursor-pointer">
                              <Edit2 className="w-4 h-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id)} className="text-red-400 hover:bg-red-500/20 cursor-pointer">
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-1 mt-1 text-[10px] text-muted-foreground ${isMe ? 'mr-1' : 'ml-12'}`}>
                  <span>{formatTime(msg.createdAt)}</span>
                  {msg.isEdited && <span>(editado)</span>}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 pt-4 border-t border-space-600 bg-space-900">
        {(fileError || sendError) && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{fileError || sendError}</span>
          </div>
        )}
        {fileUrl && (
          <div className="mb-3 relative inline-block">
            {fileUrl.startsWith('data:image') ? (
               <img src={fileUrl} alt="Preview" className="h-16 w-16 object-cover rounded border border-space-600" />
            ) : (
              <div className="h-16 px-4 bg-space-800 rounded border border-space-600 flex items-center text-xs text-muted-foreground">
                <File className="w-4 h-4 mr-2" /> Archivo cargado
              </div>
            )}
            <button 
              onClick={() => setFileUrl('')}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="cursor-pointer text-muted-foreground hover:text-cyan-400 p-2 shrink-0 transition-colors">
            <Paperclip className="w-5 h-5" />
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
          
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Escribe un mensaje al equipo del proyecto (usa @agente para interactuar con la IA)..."
            className="bg-space-800 border-space-600 text-white min-h-[44px] max-h-32 resize-none py-3"
            disabled={isSubmitting}
          />
          
          <Button 
            size="icon" 
            className="h-11 w-11 shrink-0 bg-cyan-500 hover:bg-cyan-600 text-space-900 rounded-xl"
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !fileUrl) || isSubmitting}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
