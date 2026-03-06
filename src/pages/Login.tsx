import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Satellite, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const firebaseError = err as { code?: string }
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
          setError('Error de conexión. Verifica tu conexión a internet.')
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Stars background */}
      <div className="absolute inset-0 stars-bg opacity-30" />
      
      <Card className="w-full max-w-md bg-space-800/80 border-space-600 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-xl bg-cyan-500/20">
              <Satellite className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">Bienvenido de vuelta</CardTitle>
          <CardDescription className="text-muted-foreground">
            Inicia sesión en el portal del equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="nombre@usm.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Contraseña</label>
                <Link to="/forgot-password" title="sm" className="text-xs text-cyan-400 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
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
