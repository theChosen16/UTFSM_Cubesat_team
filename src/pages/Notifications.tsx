import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Bell,
  Check,
  Inbox,
  Send,
  Mail,
  MailOpen,
  MessageSquare,
  Info,
  ClipboardList,
} from 'lucide-react'
import { collection, getDocs, doc, updateDoc, addDoc, query, where, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import { Notification as NotificationType, NOTIFICATION_LABELS } from '@/types'
import { cn } from '@/lib/utils'

type TabType = 'notifications' | 'messages'

export default function Notifications() {
  const { user, getAllUsers } = useAuth()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<TabType>('notifications')
  const [notifications, setNotifications] = useState<NotificationType[]>([])
  const [loading, setLoading] = useState(true)

  // Compose message state
  const [showCompose, setShowCompose] = useState(false)
  const [messageRecipient, setMessageRecipient] = useState('')
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [allUsers, setAllUsers] = useState<{ id: string; nombre: string; apellido: string; email: string }[]>([])

  // Auto-open compose form when navigated from Profile with composeTo state
  useEffect(() => {
    const state = location.state as { composeTo?: string; composeToName?: string } | null
    if (state?.composeTo) {
      setActiveTab('messages')
      setShowCompose(true)
      setMessageRecipient(state.composeTo)
    }
  }, [location.state])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadNotifications(), loadUsers()])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const loadNotifications = async () => {
    if (!user) return
    try {
      const snapshot = await getDocs(
        query(collection(db, 'notifications'), where('recipientId', '==', user.id))
      )
      const loaded = snapshot.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          recipientId: data.recipientId || '',
          type: data.type || 'system',
          title: data.title || '',
          message: data.message || '',
          read: data.read || false,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          senderId: data.senderId || undefined,
          senderName: data.senderName || undefined,
          relatedId: data.relatedId || undefined,
        } as NotificationType
      })
      loaded.sort((a, b) => {
        if (!a.read && b.read) return -1
        if (a.read && !b.read) return 1
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      setNotifications(loaded)
    } catch (error) {
      logger.error('Error loading notifications', { error })
    }
  }

  const loadUsers = async () => {
    try {
      const users = await getAllUsers()
      setAllUsers(users.reduce<{ id: string; nombre: string; apellido: string; email: string }[]>((acc, u) => {
        if (u.id !== user?.id) {
          acc.push({ id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email })
        }
        return acc
      }, []))
    } catch (error) {
      logger.error('Error loading users for compose', { error })
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true })
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    } catch (error) {
      logger.error('Error marking notification as read', { error })
    }
  }

  const handleSendMessage = async () => {
    if (!user || !messageRecipient || !messageText.trim()) return
    setSendingMessage(true)
    try {
      await addDoc(collection(db, 'notifications'), {
        recipientId: messageRecipient,
        type: 'message',
        title: 'Nuevo Mensaje',
        message: messageText.trim(),
        read: false,
        createdAt: Timestamp.now(),
        senderId: user.id,
        senderName: `${user.nombre} ${user.apellido}`,
      })
      setMessageSent(true)
      setMessageText('')
      setMessageRecipient('')
      setTimeout(() => {
        setMessageSent(false)
        setShowCompose(false)
      }, 2000)
    } catch (error) {
      logger.error('Error sending message', { error })
    } finally {
      setSendingMessage(false)
    }
  }

  const unreadNotificationCount = notifications.filter(n => !n.read).length
  const unreadMessageCount = notifications.filter(n => !n.read && n.type === 'message').length
  const unreadNonMessageCount = notifications.filter(n => !n.read && n.type !== 'message').length

  const getNotificationIcon = (type: NotificationType['type']) => {
    switch (type) {
      case 'task_assigned': return ClipboardList
      case 'message': return MessageSquare
      case 'system': return Info
      default: return Bell
    }
  }

  const getNotificationColor = (type: NotificationType['type']): { icon: string; bg: string } => {
    switch (type) {
      case 'task_assigned': return { icon: 'text-purple-400', bg: 'bg-purple-500/20' }
      case 'message': return { icon: 'text-blue-400', bg: 'bg-blue-500/20' }
      case 'system': return { icon: 'text-orange-400', bg: 'bg-orange-500/20' }
      default: return { icon: 'text-gray-400', bg: 'bg-gray-500/20' }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  const { filteredNotifications, messageNotifications } = notifications.reduce<{
    filteredNotifications: NotificationType[]
    messageNotifications: NotificationType[]
  }>((acc, n) => {
    if (n.type === 'message') {
      acc.messageNotifications.push(n)
    } else {
      acc.filteredNotifications.push(n)
    }
    return acc
  }, { filteredNotifications: [], messageNotifications: [] })

  const tabs: { id: TabType; label: string; icon: typeof Bell; count?: number }[] = [
    { id: 'notifications', label: 'Notificaciones', icon: Bell, count: unreadNonMessageCount },
    { id: 'messages', label: 'Mensajes', icon: MessageSquare, count: unreadMessageCount },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Buzón</h1>
          <p className="text-muted-foreground mt-1">
            Notificaciones y mensajes de la plataforma
          </p>
        </div>
        {unreadNotificationCount > 0 && (
          <Badge variant="orange" className="text-sm px-3 py-1">
            {unreadNotificationCount} sin leer
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-space-600 pb-0">
        {tabs.map(tab => {
          const TabIcon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-muted-foreground hover:text-white hover:border-space-500"
              )}
            >
              <TabIcon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-400 flex-shrink-0">
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content: Notifications */}
      {activeTab === 'notifications' && (
        <div>
          {filteredNotifications.length === 0 ? (
            <Card className="bg-space-700/50 border-space-600">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Inbox className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tienes notificaciones.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Las notificaciones sobre cambios de rol, tareas y acciones de la plataforma aparecerán aquí.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredNotifications.map(notification => {
                const Icon = getNotificationIcon(notification.type)
                const { icon: iconColor, bg: bgColor } = getNotificationColor(notification.type)
                return (
                  <Card
                    key={notification.id}
                    className={cn(
                      "bg-space-700/50 border-space-600 transition-colors",
                      !notification.read && "border-l-4 border-l-cyan-500"
                    )}
                  >
                    <CardContent className="flex items-start gap-4 py-4">
                      <div className={cn("p-2 rounded-lg", bgColor)}>
                        <Icon className={cn("w-5 h-5", iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate flex-1 min-w-0">{notification.title}</p>
                          <Badge variant="orange" className="text-xs flex-shrink-0">
                            {NOTIFICATION_LABELS[notification.type]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        {notification.senderName && (
                          <p className="text-xs text-muted-foreground mt-1">
                            De: {notification.senderName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.createdAt.toLocaleDateString('es-CL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-muted-foreground hover:text-cyan-400"
                          title="Marcar como leída"
                        >
                          <MailOpen className="w-4 h-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Messages */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          {/* Compose Button */}
          {!showCompose ? (
            <Button
              onClick={() => setShowCompose(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-space-900"
            >
              <Send className="w-4 h-4 mr-2" />
              Nuevo Mensaje
            </Button>
          ) : (
            <Card className="bg-space-700/50 border-space-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <Send className="w-5 h-5 text-cyan-400" />
                  Enviar Mensaje
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {messageSent ? (
                  <div className="p-4 rounded-lg bg-green-500/20 text-green-300 text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Mensaje enviado exitosamente.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Destinatario</label>
                      <select
                        value={messageRecipient}
                        onChange={(e) => setMessageRecipient(e.target.value)}
                        title="Seleccionar destinatario"
                        className="w-full px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="">Selecciona un usuario</option>
                        {allUsers.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} {u.apellido} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Mensaje</label>
                      <Textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Escribe tu mensaje..."
                        className="bg-space-700 border-space-500 text-white min-h-[100px]"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !messageRecipient || !messageText.trim()}
                        className="bg-cyan-500 hover:bg-cyan-600 text-space-900"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {sendingMessage ? 'Enviando...' : 'Enviar'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setShowCompose(false); setMessageText(''); setMessageRecipient('') }}
                        className="border-space-600 text-white hover:bg-space-600"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Messages List */}
          {messageNotifications.length === 0 ? (
            <Card className="bg-space-700/50 border-space-600">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tienes mensajes.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Los mensajes de otros miembros del equipo aparecerán aquí.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {messageNotifications.map(msg => (
                <Card
                  key={msg.id}
                  className={cn(
                    "bg-space-700/50 border-space-600 transition-colors",
                    !msg.read && "border-l-4 border-l-blue-500"
                  )}
                >
                  <CardContent className="flex items-start gap-4 py-4">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <MessageSquare className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-white">
                          {msg.senderName || 'Usuario'}
                        </p>
                        {!msg.read && (
                          <Badge variant="cyan" className="text-xs">Nuevo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{msg.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {msg.createdAt.toLocaleDateString('es-CL', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!msg.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMarkAsRead(msg.id)}
                        className="text-muted-foreground hover:text-blue-400"
                        title="Marcar como leído"
                      >
                        <MailOpen className="w-4 h-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
