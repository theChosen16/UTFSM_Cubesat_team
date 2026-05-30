import { useEffect, useState } from 'react'
import { Send, Eye, CheckCircle2, Calendar, Clock, Sparkles, X, Mail } from 'lucide-react'
import { EmailNotificationService } from '@/sdk/EmailNotificationService'
import { MailDigestLog } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'

export function WeeklyDigestWidget() {
  const { user } = useAuth()
  const [lastDigest, setLastDigest] = useState<MailDigestLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHTML, setPreviewHTML] = useState<string>('')
  const [compilingPreview, setCompilingPreview] = useState(false)

  const loadLastDigest = async () => {
    try {
      setLoading(true)
      const log = await EmailNotificationService.getLastDigestLog()
      setLastDigest(log)
    } catch (err) {
      logger.error('Error loading last digest log in widget', { err })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLastDigest()
  }, [])

  const handleSendDigest = async () => {
    if (!user) return
    if (!window.confirm('¿Estás seguro de que deseas forzar el envío del boletín semanal a todos los miembros activos por correo electrónico?')) {
      return
    }

    try {
      setSending(true)
      setSuccess(null)
      setError(null)
      
      const log = await EmailNotificationService.sendWeeklyDigest(user.id)
      
      setSuccess(`¡Boletín orbital enviado con éxito a ${log.recipientCount} miembros del equipo!`)
      await loadLastDigest()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el boletín semanal.')
      logger.error('Error sending weekly digest manually', { err })
    } finally {
      setSending(false)
    }
  }

  const handleOpenPreview = async () => {
    try {
      setCompilingPreview(true)
      setPreviewOpen(true)
      const data = await EmailNotificationService.compileDigestData()
      const html = EmailNotificationService.generateHTMLTemplate(user?.nombre || 'Miembro', data)
      setPreviewHTML(html)
    } catch (err) {
      logger.error('Error compiling email preview', { err })
      setPreviewHTML('<div style="color: red; padding: 20px; text-align: center;">Error al compilar la vista previa de datos.</div>')
    } finally {
      setCompilingPreview(false)
    }
  }

  // Calcular días desde el último boletín
  let daysSinceLast = -1
  let progressPercent = 0
  let daysRemaining = 7

  if (lastDigest) {
    const diffMs = Date.now() - new Date(lastDigest.createdAt).getTime()
    daysSinceLast = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    daysRemaining = Math.max(0, 7 - daysSinceLast)
    progressPercent = Math.min(100, (daysSinceLast / 7) * 100)
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <Card className="bg-space-700/50 border-space-600 shadow-xl overflow-hidden relative group">
        {/* Glow effect on hover */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-sm pointer-events-none" />
        
        <CardHeader className="relative z-10">
          <CardTitle className="text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span>Noticiario Semanal & Boletín</span>
          </CardTitle>
          <CardDescription>
            Automatización semanal de eventos próximos y logros del equipo por correo.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 relative z-10">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Last digest status info */}
              <div className="rounded-xl border border-space-600 bg-space-800/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Último Envío
                  </span>
                  {lastDigest ? (
                    <Badge variant="green" className="text-[10px]">Completado</Badge>
                  ) : (
                    <Badge variant="orange" className="text-[10px]">Pendiente Inicial</Badge>
                  )}
                </div>

                {lastDigest ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {formatDateTime(new Date(lastDigest.createdAt))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Despachado a <span className="text-cyan-400 font-bold">{lastDigest.recipientCount} miembros</span> del equipo técnico.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Contuvo <span className="text-purple-400 font-semibold">{lastDigest.eventsCount} eventos</span> y{' '}
                      <span className="text-purple-400 font-semibold">{lastDigest.tasksCount} tareas</span> de la órbita.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 font-medium">
                    Aún no se ha despachado ningún noticiario semanal.
                  </p>
                )}
              </div>

              {/* Progress and automation countdown */}
              {lastDigest && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      Próxima automatización en
                    </span>
                    <span className="text-cyan-400 font-bold">
                      {daysRemaining === 0 ? 'Inminente' : `${daysRemaining} día(s)`}
                    </span>
                  </div>
                  
                  {/* Progress bar container */}
                  <div className="h-2 w-full rounded-full bg-space-800 border border-space-600 overflow-hidden">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-1000 ease-out`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    * El daemon se ejecuta de forma silenciosa al loguearse un manager si han pasado 7 días desde el último boletín.
                  </p>
                </div>
              )}

              {/* Feedback messages */}
              {success && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-start gap-2 text-xs text-green-300 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>{success}</div>
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 animate-fade-in">
                  {error}
                </div>
              )}

              {/* Actions row */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button 
                  onClick={handleOpenPreview} 
                  variant="outline" 
                  size="sm"
                  className="flex-1 bg-space-800 hover:bg-space-700 text-slate-200 border-space-500 flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Ver Boletín
                </Button>
                <Button 
                  onClick={handleSendDigest} 
                  disabled={sending} 
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  {sending ? (
                    <>
                      <Spinner className="w-4 h-4 border-t-white" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar Ahora
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal Overlay */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-4xl h-[90vh] bg-space-800 border border-space-600 rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-space-600 px-6 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                <div>
                  <h3 className="text-base font-bold text-white">Vista Previa de Boletín Orbital</h3>
                  <p className="text-xs text-muted-foreground">Esta plantilla HTML interactiva es la que reciben los miembros por correo.</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-space-700 hover:text-white transition-colors"
                aria-label="Cerrar vista previa"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 bg-space-900 overflow-hidden relative">
              {compilingPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Spinner className="w-8 h-8" />
                  <p className="text-sm text-cyan-400 font-medium">Compilando novedades e hitos de la órbita...</p>
                </div>
              ) : (
                <iframe 
                  srcDoc={previewHTML} 
                  title="Weekly Digest Email Preview" 
                  className="w-full h-full border-0 bg-[#0b0f19]"
                  sandbox="allow-same-origin"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-space-600 px-6 py-4 flex justify-between items-center bg-space-850">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                Filtrado por hitos y eventos en el rango actual de 7 días.
              </span>
              <Button 
                onClick={() => setPreviewOpen(false)}
                variant="outline" 
                size="sm"
                className="bg-space-700 hover:bg-space-600 text-white border-space-500"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
