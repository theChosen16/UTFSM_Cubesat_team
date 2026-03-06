import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Cpu, 
  Users, 
  Globe,
  Crown,
  Edit
} from 'lucide-react'
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/types'

export default function Profile() {
  const { user } = useAuth()

  if (!user) return null

  const getRoleIcon = () => {
    switch (user.rol) {
      case 'maestro': return Crown
      case 'manager': return Users
      case 'tecnico': return Cpu
      case 'relaciones_publicas': return Globe
      default: return User
    }
  }

  const getRoleVariant = (): 'orange' | 'cyan' | 'purple' | 'green' => {
    switch (user.rol) {
      case 'maestro': return 'orange'
      case 'manager': return 'cyan'
      case 'tecnico': return 'purple'
      case 'relaciones_publicas': return 'green'
    }
  }

  const RoleIcon = getRoleIcon()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Mi Perfil</h1>
        <p className="text-muted-foreground mt-1">
          Información personal y configuración de cuenta
        </p>
      </div>

      {/* Profile Card */}
      <Card className="bg-space-700/50 border-space-600">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">
                  {user.nombre[0]}{user.apellido[0]}
                </span>
              </div>
              <div>
                <CardTitle className="text-2xl text-white">
                  {user.nombre} {user.apellido}
                </CardTitle>
                <CardDescription className="text-base">{user.email}</CardDescription>
              </div>
            </div>
            
            {/* Edit Button */}
            <div className="md:ml-auto">
              <Button variant="outline" className="border-space-600 text-white hover:bg-space-600">
                <Edit className="w-4 h-4 mr-2" />
                Editar Perfil
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Role Section */}
          <div className="p-4 rounded-lg bg-space-600/50">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-${getRoleVariant()}-500/20`}>
                <RoleIcon className={`w-6 h-6 text-${getRoleVariant()}-400`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getRoleVariant()}>
                    {ROLE_LABELS[user.rol]}
                  </Badge>
                  {user.rol === 'maestro' && (
                    <Shield className="w-4 h-4 text-orange-400" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {ROLE_DESCRIPTIONS[user.rol]}
                </p>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-space-600/50">
              <Mail className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-sm text-muted-foreground">Correo electrónico</p>
                <p className="text-white">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-space-600/50">
              <Calendar className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-muted-foreground">Miembro desde</p>
                <p className="text-white">
                  {user.createdAt instanceof Date 
                    ? user.createdAt.toLocaleDateString('es-CL', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : 'Fecha no disponible'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Permisos del Rol</h3>
            <div className="grid gap-2">
              {user.rol === 'maestro' && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4 text-orange-400" />
                    <span>Administración total del sistema</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4 text-orange-400" />
                    <span>Asignar y cambiar roles de miembros</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4 text-orange-400" />
                    <span>Eliminar miembros del equipo</span>
                  </div>
                </>
              )}
              {(user.rol === 'maestro' || user.rol === 'manager') && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>Crear y gestionar proyectos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>Asignar tareas a equipos</span>
                  </div>
                </>
              )}
              {user.rol === 'tecnico' && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <span>Ver proyectos asignados</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <span>Actualizar estado de tareas</span>
                  </div>
                </>
              )}
              {user.rol === 'relaciones_publicas' && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="w-4 h-4 text-green-400" />
                    <span>Gestionar redes sociales</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="w-4 h-4 text-green-400" />
                    <span>Coordinar recursos universitarios</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
