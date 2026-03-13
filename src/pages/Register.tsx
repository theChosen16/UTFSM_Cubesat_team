import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import { VALID_EMAIL_DOMAINS } from '@/lib/constants'
import { extractFullNameFromEmail } from '@/lib/utils'

export default function Register() {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp, user } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const validateEmail = (email: string) => {
    return VALID_EMAIL_DOMAINS.some(domain => email.toLowerCase().endsWith(domain))
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (!nombre && !apellido && value.includes('@')) {
      const { nombre: n, apellido: a } = extractFullNameFromEmail(value)
      if (n) setNombre(n)
      if (a) setApellido(a)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateEmail(email)) {
      setError('Debes usar un correo institucional de la USM (@usm.cl o @sansano.usm.cl)')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password, nombre, apellido)
      navigate('/dashboard')
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string }
      logger.error('Registration failed', { code: firebaseError.code, email })
      if (firebaseError.code === 'auth/invalid-email') {
        setError('El correo electrónico no es válido.')
      } else if (firebaseError.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado. Inicia sesión desde la página de login.')
      } else if (firebaseError.code === 'auth/operation-not-allowed') {
        setError('El registro con correo y contraseña no está habilitado en Firebase.')
      } else if (firebaseError.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil. Usa al menos 6 caracteres.')
      } else {
        setError(`Error: ${firebaseError.message || 'No se pudo crear la cuenta'}`)
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
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USM Cubesat" className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">Únete al equipo</CardTitle>
          <CardDescription className="text-muted-foreground">
            Crea tu cuenta para comenzar
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nombre</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Juan"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Apellido</label>
                <Input
                  type="text"
                  placeholder="Pérez"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Correo institucional</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="nombre@usm.cl"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  required
                />
              </div>
              {validateEmail(email) && (
                <div className="flex items-center gap-1 text-green-400 text-xs">
                  <CheckCircle className="w-3 h-3" />
                  <span>Correo institucional válido</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Contraseña</label>
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

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-cyan-400 hover:underline">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
