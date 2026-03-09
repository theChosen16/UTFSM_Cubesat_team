import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  Check,
  X,
  UserPlus,
  Shield
} from 'lucide-react'
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import { RoleRequest, ROLE_LABELS } from '@/types'

export default function Notifications() {
  const { user, updateUserRole } = useAuth()
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'role_requests'))
      const loaded = snapshot.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          userId: data.userId || '',
          userEmail: data.userEmail || '',
          userName: data.userName || '',
          rolSolicitado: data.rolSolicitado || 'manager',
          mensaje: data.mensaje || '',
          estado: data.estado || 'pendiente',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          resolvedAt: data.resolvedAt?.toDate?.() || undefined,
          resolvedBy: data.resolvedBy || undefined,
        } as RoleRequest
      })
      loaded.sort((a, b) => {
        if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1
        if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      setRequests(loaded)
    } catch (error) {
      logger.error('Error loading role requests', { error })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (request: RoleRequest) => {
    if (!user) return
    setProcessing(request.id)
    try {
      await updateUserRole(request.userId, request.rolSolicitado)
      await updateDoc(doc(db, 'role_requests', request.id), {
        estado: 'aprobado',
        resolvedAt: Timestamp.now(),
        resolvedBy: user.id,
      })
      await loadRequests()
    } catch (error) {
      logger.error('Error approving role request', { error })
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (request: RoleRequest) => {
    if (!user) return
    setProcessing(request.id)
    try {
      await updateDoc(doc(db, 'role_requests', request.id), {
        estado: 'rechazado',
        resolvedAt: Timestamp.now(),
        resolvedBy: user.id,
      })
      await loadRequests()
    } catch (error) {
      logger.error('Error rejecting role request', { error })
    } finally {
      setProcessing(null)
    }
  }

  const pendingCount = requests.filter(r => r.estado === 'pendiente').length

  if (user?.rol !== 'maestro') {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No tienes permisos para ver esta página.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Solicitudes de Rol</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las solicitudes de cambio de rol de los miembros
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="orange" className="text-sm px-3 py-1">
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <Card className="bg-space-700/50 border-space-600">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay solicitudes de rol.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Las solicitudes aparecerán aquí cuando los miembros soliciten un cambio de rol.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map(request => (
            <Card key={request.id} className="bg-space-700/50 border-space-600">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <UserPlus className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">{request.userName}</CardTitle>
                      <CardDescription>{request.userEmail}</CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      request.estado === 'pendiente' ? 'orange' :
                      request.estado === 'aprobado' ? 'green' : 'red'
                    }
                  >
                    {request.estado === 'pendiente' ? 'Pendiente' :
                     request.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <span>Solicita rol: </span>
                  <span className="text-white font-medium">
                    {ROLE_LABELS[request.rolSolicitado]}
                  </span>
                </div>
                {request.mensaje && (
                  <p className="text-sm text-muted-foreground bg-space-800/50 p-3 rounded-lg border border-space-600">
                    {request.mensaje}
                  </p>
                )}
                <div className="text-xs text-muted-foreground">
                  Solicitado: {request.createdAt.toLocaleDateString('es-CL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
                {request.estado === 'pendiente' && (
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => handleApprove(request)}
                      disabled={processing === request.id}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {processing === request.id ? 'Procesando...' : 'Aprobar'}
                    </Button>
                    <Button
                      onClick={() => handleReject(request)}
                      disabled={processing === request.id}
                      variant="outline"
                      className="border-red-500 text-red-400 hover:bg-red-500/20"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Rechazar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
