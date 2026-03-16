import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      await resetPassword(email)
      setMessage('Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.')
    } catch (err: unknown) {
      logger.error('Error al restablecer contraseña', { error: err instanceof Error ? err : undefined })
      const firebaseError = err as { code?: string }
      if (firebaseError.code === 'auth/user-not-found') {
        setError('No existe una cuenta con este correo electrónico.')
      } else {
        setError('Ocurrió un error. Por favor intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 stars-bg opacity-30" />
      
      <Card className="w-full max-w-md bg-space-800/80 border-space-600 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-xl bg-cyan-500/20">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USM Cubesat" className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">Recuperar Contraseña</CardTitle>
          <CardDescription className="text-muted-foreground">
            Ingresa tu correo institucional para recibir un enlace de recuperación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm animate-fade-in" role="alert">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {message && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/20 text-green-400 text-sm animate-fade-in" role="status">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="forgot-email" className="text-sm text-muted-foreground">Correo institucional</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="nombre@usm.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-space-900 font-semibold"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar Enlace'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-cyan-400 hover:underline flex items-center justify-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
