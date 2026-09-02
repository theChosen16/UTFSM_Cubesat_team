import { ReactNode, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { User as UserIcon, AlertCircle, MailCheck, ShieldAlert } from 'lucide-react'
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
  const { emailVerified, hasProfile } = useAuth()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // An unverified account that has no workspace profile is not a member yet: firestore.rules
  // denies it every read and write, so rendering the app would only produce a wall of
  // permission errors. Show the verification step instead — it is the actual next action.
  //
  // An unverified account that DOES have a profile registered before verification was enforced
  // keeps working (the rules grandfather it) and gets a persistent banner instead of a wall,
  // so the migration does not lock the existing team out of their own workspace.
  if (!emailVerified && hasProfile === false) {
    return <VerifyEmailOverlay />
  }

  if (!user.nombre || !user.apellido) {
    return <CompleteNameOverlay />
  }

  return (
    <>
      {!emailVerified && <UnverifiedEmailBanner />}
      {children}
    </>
  )
}

/**
 * Blocking step for an account whose institutional address has not been verified and which has
 * therefore not been provisioned into the workspace.
 */
function VerifyEmailOverlay() {
  const { firebaseUser, sendVerificationEmail, refreshVerificationStatus, signOut } = useAuth()
  const [status, setStatus] = useState<'idle' | 'sent' | 'still-unverified' | 'error'>('idle')
  const [loading, setLoading] = useState(false)

  const handleResend = async () => {
    setLoading(true)
    try {
      await sendVerificationEmail()
      setStatus('sent')
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const handleCheck = async () => {
    setLoading(true)
    try {
      const verified = await refreshVerificationStatus()
      setStatus(verified ? 'idle' : 'still-unverified')
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
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
            <span className="text-cyan-400">{firebaseUser?.email}</span>. Ábrelo para activar tu
            cuenta en el espacio de trabajo del equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El acceso a proyectos, tareas y archivos del equipo requiere una dirección
            institucional verificada: es lo que demuestra que la cuenta pertenece realmente a una
            persona de la USM.
          </p>

          {status === 'sent' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm" role="status">
              <MailCheck className="w-4 h-4 flex-shrink-0" />
              <span>Correo de verificación reenviado. Revisa tu bandeja y la carpeta de spam.</span>
            </div>
          )}
          {status === 'still-unverified' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/20 text-amber-300 text-sm" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Todavía no detectamos la verificación. Abre el enlace y vuelve a intentar.</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>No se pudo completar la operación. Intenta nuevamente en unos minutos.</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleCheck}
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-space-900 font-semibold"
            >
              {loading ? 'Comprobando...' : 'Ya verifiqué mi correo'}
            </Button>
            <Button onClick={handleResend} disabled={loading} variant="ghost" className="w-full">
              Reenviar correo de verificación
            </Button>
            <Button onClick={() => void signOut()} variant="ghost" className="w-full text-muted-foreground">
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Non-blocking reminder for accounts that predate the verification requirement. They keep full
 * access (firestore.rules grandfathers an already-provisioned profile) but should verify so the
 * grandfather clause can eventually be removed.
 */
function UnverifiedEmailBanner() {
  const { sendVerificationEmail, refreshVerificationStatus } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    setLoading(true)
    try {
      const alreadyVerified = await refreshVerificationStatus()
      if (alreadyVerified) return
      await sendVerificationEmail()
      setMessage('Te enviamos un enlace de verificación. Revisa tu bandeja de entrada.')
    } catch {
      setMessage('No se pudo enviar el correo de verificación. Intenta más tarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
      <ShieldAlert className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-[12rem]">
        {message ?? 'Tu correo institucional aún no está verificado. Verifícalo para mantener el acceso al espacio de trabajo.'}
      </span>
      <button
        type="button"
        onClick={handleVerify}
        disabled={loading}
        className="rounded-md border border-amber-400/40 px-2 py-1 font-medium text-amber-100 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
      >
        {loading ? 'Enviando...' : 'Verificar ahora'}
      </button>
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
