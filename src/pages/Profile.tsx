import { ChangeEvent, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Cpu, 
  Users, 
  Globe,
  Crown,
  Edit,
  GraduationCap,
  BookOpen,
  Heart,
  Clock,
  Briefcase,
  Save,
  Settings,
  Rocket
} from 'lucide-react'
import { ROLE_LABELS, ROLE_DESCRIPTIONS, UserRole, Questionnaire } from '@/types'
import { logger } from '@/lib/logger'

const ROLE_STYLES: Record<UserRole, { badge: 'orange' | 'red' | 'cyan' | 'purple' | 'green'; icon: string; background: string }> = {
  maestro: {
    badge: 'orange',
    icon: 'text-orange-400',
    background: 'bg-orange-500/20'
  },
  admin: {
    badge: 'red',
    icon: 'text-red-400',
    background: 'bg-red-500/20'
  },
  manager: {
    badge: 'cyan',
    icon: 'text-cyan-400',
    background: 'bg-cyan-500/20'
  },
  tecnico: {
    badge: 'purple',
    icon: 'text-purple-400',
    background: 'bg-purple-500/20'
  },
  relaciones_publicas: {
    badge: 'green',
    icon: 'text-green-400',
    background: 'bg-green-500/20'
  }
}

export default function Profile() {
  const { user, updateUserProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Profile fields
  const [career, setCareer] = useState(user?.career || '')
  const [year, setYear] = useState(user?.year || '')
  
  // Questionnaire fields
  const [intereses, setIntereses] = useState(user?.questionnaire?.intereses || '')
  const [habilidades, setHabilidades] = useState(user?.questionnaire?.habilidades || '')
  const [motivacion, setMotivacion] = useState(user?.questionnaire?.motivacion || '')
  const [disponibilidad, setDisponibilidad] = useState(user?.questionnaire?.disponibilidad || '')
  const [proyectosPrevios, setProyectosPrevios] = useState(user?.questionnaire?.proyectosPrevios || '')

  useEffect(() => {
    if (user) {
      setCareer(user.career || '')
      setYear(user.year || '')
      setIntereses(user.questionnaire?.intereses || '')
      setHabilidades(user.questionnaire?.habilidades || '')
      setMotivacion(user.questionnaire?.motivacion || '')
      setDisponibilidad(user.questionnaire?.disponibilidad || '')
      setProyectosPrevios(user.questionnaire?.proyectosPrevios || '')
    }
  }, [user])

  if (!user) return null

  const handleSave = async () => {
    setLoading(true)
    try {
      const questionnaire: Questionnaire = {
        intereses,
        habilidades,
        motivacion,
        disponibilidad,
        proyectosPrevios
      }
      await updateUserProfile({
        career,
        year,
        questionnaire
      })
      setIsEditing(false)
    } catch (error) {
      logger.error('Error updating profile', { error: error instanceof Error ? error : undefined })
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (rol: UserRole) => {
    switch (rol) {
      case 'maestro': return Crown
      case 'admin': return Settings
      case 'manager': return Users
      case 'tecnico': return Cpu
      case 'relaciones_publicas': return Globe
      default: return User
    }
  }

  const RoleIcon = getRoleIcon(user.rol)
  const roleStyles = ROLE_STYLES[user.rol]
  const handleInputChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(event.target.value)
  }

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
              {!isEditing ? (
                <Button 
                  onClick={() => setIsEditing(true)}
                  variant="outline" 
                  className="border-space-600 text-white hover:bg-space-600"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Completar Cuestionario
                </Button>
              ) : (
                <Button 
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-cyan-500 hover:bg-cyan-600 text-space-900"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Role Section */}
          <div className="p-4 rounded-lg bg-space-600/50">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${roleStyles.background}`}>
                  <RoleIcon className={`w-6 h-6 ${roleStyles.icon}`} />
                </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={roleStyles.badge}>
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
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Correo electrónico</p>
                <p className="text-white">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-space-600/50">
              <GraduationCap className="w-5 h-5 text-purple-400" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Carrera</p>
                {isEditing ? (
                  <Input 
                    value={career}
                    onChange={handleInputChange(setCareer)}
                    placeholder="Ej: Ingeniería Civil Informática"
                    className="bg-space-700 border-space-500 text-white text-sm h-8 mt-1"
                  />
                ) : (
                  <p className="text-white">{user.career || 'No especificada'}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-space-600/50">
              <BookOpen className="w-5 h-5 text-green-400" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Año de Carrera</p>
                {isEditing ? (
                  <Input 
                    value={year}
                    onChange={handleInputChange(setYear)}
                    placeholder="Ej: 3er año"
                    className="bg-space-700 border-space-500 text-white text-sm h-8 mt-1"
                  />
                ) : (
                  <p className="text-white">{user.year || 'No especificado'}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-space-600/50">
              <Calendar className="w-5 h-5 text-orange-400" />
              <div className="flex-1">
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

          {/* Questionnaire Section */}
          <div className="space-y-4 pt-4 border-t border-space-600">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Cuestionario de Cualidades e Intereses
            </h3>
            <p className="text-sm text-muted-foreground">
              Ayúdanos a conocerte mejor para asignar los roles y proyectos que mejor se adapten a ti.
            </p>

            <div className="space-y-6 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" />
                  ¿Cuáles son tus principales áreas de interés en el equipo?
                </label>
                {isEditing ? (
                  <Textarea 
                    value={intereses}
                    onChange={handleInputChange(setIntereses)}
                    placeholder="Ej: Telecomunicaciones, propulsión, diseño 3D, etc."
                    className="bg-space-700 border-space-500 text-white min-h-[80px]"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground bg-space-800/50 p-3 rounded-lg border border-space-600">
                    {user.questionnaire?.intereses || 'Aún no respondido.'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  ¿Qué habilidades técnicas o blandas posees?
                </label>
                {isEditing ? (
                  <Textarea 
                    value={habilidades}
                    onChange={handleInputChange(setHabilidades)}
                    placeholder="Ej: Programación C++, Python, manejo de herramientas de taller, liderazgo, etc."
                    className="bg-space-700 border-space-500 text-white min-h-[80px]"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground bg-space-800/50 p-3 rounded-lg border border-space-600">
                    {user.questionnaire?.habilidades || 'Aún no respondido.'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-orange-400" />
                  ¿Qué te motiva a formar parte del USM Cubesat Team?
                </label>
                {isEditing ? (
                  <Textarea 
                    value={motivacion}
                    onChange={handleInputChange(setMotivacion)}
                    placeholder="Cuéntanos por qué quieres participar..."
                    className="bg-space-700 border-space-500 text-white min-h-[80px]"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground bg-space-800/50 p-3 rounded-lg border border-space-600">
                    {user.questionnaire?.motivacion || 'Aún no respondido.'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  ¿Cuál es tu disponibilidad horaria aproximada?
                </label>
                {isEditing ? (
                  <Input 
                    value={disponibilidad}
                    onChange={handleInputChange(setDisponibilidad)}
                    placeholder="Ej: 5-10 horas semanales, principalmente tardes."
                    className="bg-space-700 border-space-500 text-white"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground bg-space-800/50 p-3 rounded-lg border border-space-600">
                    {user.questionnaire?.disponibilidad || 'Aún no respondido.'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-green-400" />
                  ¿Has participado en proyectos previos (universitarios o personales)?
                </label>
                {isEditing ? (
                  <Textarea 
                    value={proyectosPrevios}
                    onChange={handleInputChange(setProyectosPrevios)}
                    placeholder="Describe brevemente tus experiencias..."
                    className="bg-space-700 border-space-500 text-white min-h-[80px]"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground bg-space-800/50 p-3 rounded-lg border border-space-600">
                    {user.questionnaire?.proyectosPrevios || 'Aún no respondido.'}
                  </p>
                )}
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
              {user.rol === 'admin' && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4 text-red-400" />
                    <span>Gestión de contenido y proyectos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4 text-red-400" />
                    <span>Gestionar miembros y asignar roles (excepto maestro)</span>
                  </div>
                </>
              )}
              {(user.rol === 'maestro' || user.rol === 'admin' || user.rol === 'manager') && (
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
