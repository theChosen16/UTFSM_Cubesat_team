import { ReactNode, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { User as UserIcon, AlertCircle, MailCheck, LogOut, RefreshCw, ShieldOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { User } from '@/types'

interface ProtectedRouteProps {
  children: ReactNode
  user: User | null
}

export default function ProtectedRoute({ children, user }: ProtectedRouteProps) {
  const location = useLocation()
  const { firebaseUser } = useAuth()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Membership gate. An @usm.cl address only proves membership once someone has demonstrated
  // they can receive mail at it — Firebase's email/password sign-up never checks that, so
  // without this an outsider could register any plausible institutional address and read the
  // whole private workspace under a real member's name. `isInstitutional()` in firestore.rules
  // now requires `email_verified`, which means an unverified session can no longer load any of
  // the pages below anyway; this gate turns that into a self-service "verify and continue"
  // instead of a wall of failed queries, and is the flow that made enforcing the claim safe for
  // members who registered before verification existed.
  if (firebaseUser && !firebaseUser.emailVerified) {
    return <VerifyEmailOverlay email={firebaseUser.email} />
  }

  // Membresía revocada. `isInstitutional()` en firestore.rules niega todo el espacio de trabajo
  // a un perfil con `isActive: false`; esta pantalla lo explica en vez de dejar al usuario frente
  // a consultas fallidas. Solo el propio perfil sigue siendo legible, que es lo que la alimenta.
  if (user.isActive === false) {
    return <DeactivatedOverlay />
  }

  if (!user.nombre || !user.apellido) {
    return <CompleteNameOverlay />
  }

  return <>{children}</>
}

function VerifyEmailOverlay({ email }: { email: string | null }) {
  const { resendVerificationEmail, refreshVerificationStatus, signOut } = useAuth()
  const [status, setStatus] = useState<'idle' | 'sent' | 'still-pending'>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleResend = async () => {
    setError('')
    setStatus('idle')
    setBusy(true)
    try {
      await resendVerificationEmail()
      setStatus('sent')
    } catch {
      setError('No pudimos reenviar el correo. Espera unos minutos e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const handleRecheck = async () => {
    setError('')
    setStatus('idle')
    setBusy(true)
    try {
      const verified = await refreshVerificationStatus()
      if (!verified) setStatus('still-pending')
    } catch {
      setError('No pudimos comprobar el estado de tu cuenta. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-safe-screen min-h-screen bg-space-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 stars-bg opacity-30" />
      <Card className="w-full max-w-md bg-space-800 border-space-600 z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-full bg-cyan-500/20">
              <MailCheck className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <CardTitle className="text-xl text-white">Verifica tu correo institucional</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enviamos un enlace de verificación a{' '}
            <span className="text-cyan-400 break-all">{email || 'tu correo institucional'}</span>.
            Ábrelo y luego vuelve aquí para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {status === 'sent' && (
            <div className="p-3 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm" role="status">
              Correo de verificación reenviado. Revisa tu bandeja de entrada y la carpeta de spam.
            </div>
          )}

          {status === 'still-pending' && (
            <div className="p-3 rounded-lg bg-amber-500/20 text-amber-300 text-sm" role="status">
              Tu cuenta aún figura como no verificada. Abre el enlace del correo y vuelve a comprobar.
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            La plataforma es privada del equipo USM CubeSat, por lo que solo damos acceso a
            direcciones institucionales cuya propiedad ha sido confirmada.
          </p>

          <Button
            onClick={handleRecheck}
            disabled={busy}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-space-900 font-semibold"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {busy ? 'Comprobando...' : 'Ya verifiqué mi correo'}
          </Button>

          <Button
            onClick={handleResend}
            disabled={busy}
            variant="outline"
            className="w-full border-space-500 text-white hover:bg-space-700"
          >
            Reenviar correo de verificación
          </Button>

          <Button
            onClick={() => { void signOut() }}
            variant="ghost"
            className="w-full text-muted-foreground hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function DeactivatedOverlay() {
  const { signOut } = useAuth()

  return (
    <div className="min-safe-screen min-h-screen bg-space-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 stars-bg opacity-30" />
      <Card className="w-full max-w-md bg-space-800 border-space-600 z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-full bg-red-500/20">
              <ShieldOff className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <CardTitle className="text-xl text-white">Cuenta desactivada</CardTitle>
          <CardDescription className="text-muted-foreground">
            Tu acceso a la plataforma del equipo USM CubeSat fue desactivado. Si crees que es un
            error, contacta a un administrador del equipo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => { void signOut() }}
            variant="outline"
            className="w-full border-space-500 text-white hover:bg-space-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function CompleteNameOverlay() {
  const { updateUserProfile } = useAuth()
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedNombre = nombre.trim()
    const trimmedApellido = apellido.trim()

    if (!trimmedNombre || !trimmedApellido) {
      setError('Debes ingresar tu nombre y apellido para continuar')
      return
    }

    setLoading(true)
    try {
      await updateUserProfile({ nombre: trimmedNombre, apellido: trimmedApellido })
    } catch {
      setError('Error al guardar tu nombre. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-safe-screen min-h-screen bg-space-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 stars-bg opacity-30" />
      <Card className="w-full max-w-sm bg-space-800 border-space-600 z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-full bg-cyan-500/20">
              <UserIcon className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <CardTitle className="text-xl text-white">Completa tu perfil</CardTitle>
          <CardDescription className="text-muted-foreground">
            Necesitamos tu nombre y apellido para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm" role="alert">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="complete-nombre" className="text-sm text-muted-foreground">Nombre</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="complete-nombre"
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
              <label htmlFor="complete-apellido" className="text-sm text-muted-foreground">Apellido</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="complete-apellido"
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
              {loading ? 'Guardando...' : 'Continuar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
