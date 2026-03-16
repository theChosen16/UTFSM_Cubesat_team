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
  const [nameError, setNameError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNameStep, setShowNameStep] = useState(false)
  const { signUp, user } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const validateEmail = (emailValue: string) => {
    return VALID_EMAIL_DOMAINS.some(domain => emailValue.toLowerCase().endsWith(domain))
  }

  const handleFirstStep = (e: React.FormEvent) => {
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

    // Pre-fill nombre/apellido from email as suggestion
    const { nombre: n, apellido: a } = extractFullNameFromEmail(email)
    if (n && !nombre) setNombre(n)
    if (a && !apellido) setApellido(a)

    setShowNameStep(true)
  }

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameError('')

    const trimmedNombre = nombre.trim()
    const trimmedApellido = apellido.trim()

    if (!trimmedNombre || !trimmedApellido) {
      setNameError('Debes ingresar tu nombre y apellido para continuar')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password, trimmedNombre, trimmedApellido)
      navigate('/dashboard')
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string }
      logger.error('Registration failed', { code: firebaseError.code, email })
      // Go back to step 1 on auth errors so user can fix email/password
      setShowNameStep(false)
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

      {/* Name step modal overlay */}
      {showNameStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm bg-space-800 border-space-600 animate-fade-in">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-full bg-cyan-500/20">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
              <CardTitle className="text-xl text-white">¿Cómo te llamas?</CardTitle>
              <CardDescription className="text-muted-foreground">
                Ingresa tu nombre y apellido para completar tu registro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNameSubmit} className="space-y-4" noValidate>
                {nameError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm animate-fade-in" role="alert">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{nameError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="reg-nombre" className="text-sm text-muted-foreground">Nombre</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="reg-nombre"
                      type="text"
                      placeholder="Juan"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                      autoComplete="given-name"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="reg-apellido" className="text-sm text-muted-foreground">Apellido</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="reg-apellido"
                      type="text"
                      placeholder="Pérez"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                      autoComplete="family-name"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-space-900 font-semibold"
                  disabled={loading}
                >
                  {loading ? 'Creando cuenta...' : 'Continuar'}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowNameStep(false)}
                  className="w-full text-sm text-muted-foreground hover:text-white transition-colors"
                  disabled={loading}
                >
                  Volver
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Card className="w-full max-w-md bg-space-800 border-space-600">
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
          <form onSubmit={handleFirstStep} className="space-y-4" noValidate>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm animate-fade-in" role="alert" id="register-error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="reg-email" className="text-sm text-muted-foreground">Correo institucional</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="nombre@usm.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  autoComplete="email"
                  required
                  aria-describedby={error ? 'register-error' : undefined}
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
              <label htmlFor="reg-password" className="text-sm text-muted-foreground">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="reg-confirm-password" className="text-sm text-muted-foreground">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reg-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-space-700 border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-space-900 font-semibold"
              disabled={loading}
            >
              Crear Cuenta
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
