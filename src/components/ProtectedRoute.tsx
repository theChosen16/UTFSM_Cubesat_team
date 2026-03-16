import { ReactNode, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { User as UserIcon, AlertCircle } from 'lucide-react'
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

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!user.nombre || !user.apellido) {
    return <CompleteNameOverlay />
  }

  return <>{children}</>
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
    <div className="min-h-screen bg-space-900 flex items-center justify-center p-4 relative overflow-hidden">
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
