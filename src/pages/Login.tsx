import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'

function isBlockedByClient(err: unknown): boolean {
  const message = String((err as Error)?.message || '')
  return (
    message.includes('ERR_BLOCKED_BY_CLIENT') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [blockerWarning, setBlockerWarning] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, user } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBlockerWarning(false)
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const firebaseError = err as { code?: string }

      logger.warn('Login failed', { code: firebaseError.code, email })

      if (isBlockedByClient(err)) {
        setBlockerWarning(true)
        setError('La conexión a Firebase fue bloqueada. Desactiva tu bloqueador de anuncios o extensiones del navegador y recarga la página.')
      } else {
        switch (firebaseError.code) {
          case 'auth/user-not-found':
            setError('No existe una cuenta con este correo electrónico.')
            break
          case 'auth/wrong-password':
            setError('La contraseña es incorrecta.')
            break
          case 'auth/invalid-credential':
            setError('Credenciales inválidas. Verifica tu email y contraseña.')
            break
          case 'auth/too-many-requests':
            setError('Demasiados intentos fallidos. Intenta de nuevo más tarde.')
            break
          case 'auth/network-request-failed':
            setBlockerWarning(true)
            setError('Error de conexión. Verifica tu conexión a internet o desactiva tu bloqueador de anuncios.')
            break
          case 'auth/invalid-email':
            setError('El correo electrónico no es válido.')
            break
          case 'auth/user-disabled':
            setError('Esta cuenta ha sido deshabilitada.')
            break
          default:
            setError('Credenciales inválidas. Verifica tu email y contraseña.')
            break
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Stars background */}
      <div className="absolute inset-0 stars-bg opacity-30" />
      
      <Card className="w-full max-w-md bg-space-800 border-space-600">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-xl bg-cyan-500/20">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USM Cubesat" className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">Bienvenido de vuelta</CardTitle>
          <CardDescription className="text-muted-foreground">
            Inicia sesión en el portal del equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                id="login-error"
                className={`flex items-start gap-2 p-3 rounded-lg text-sm animate-fade-in ${
                  blockerWarning
                    ? 'bg-yellow-500/20 text-yellow-300'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {blockerWarning ? (
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm text-muted-foreground">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="nombre@usm.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  autoComplete="email"
                  required
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm text-muted-foreground">Contraseña</label>
                <Link to="/forgot-password" title="sm" className="text-xs text-cyan-400 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-space-900 font-semibold"
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-cyan-400 hover:underline">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
