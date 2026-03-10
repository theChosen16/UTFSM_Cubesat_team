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
  Rocket,
  Camera
} from 'lucide-react'
import { ROLE_LABELS, ROLE_DESCRIPTIONS, UserRole, Questionnaire, TeamType, TEAM_LABELS, Genero } from '@/types'
import { logger } from '@/lib/logger'
import { extractNameFromEmail } from '@/lib/utils'

const ROLE_STYLES: Record<UserRole, { badge: 'orange' | 'red'; icon: string; background: string }> = {
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
}

export default function Profile() {
  const { user, updateUserProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  
  // Profile fields
  const [career, setCareer] = useState(user?.career || '')
  const [year, setYear] = useState(user?.year || '')
  const [equipo, setEquipo] = useState<TeamType | ''>(user?.equipo || '')
  const [genero, setGenero] = useState<Genero | ''>(user?.genero || '')
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  
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
      setEquipo(user.equipo || '')
      setGenero(user.genero || '')
      setPhotoURL(user.photoURL || '')
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
        ...(equipo ? { equipo: equipo as TeamType } : {}),
        ...(genero ? { genero: genero as Genero } : {}),
        ...(photoURL ? { photoURL } : {}),
        questionnaire
      })
      setIsEditing(false)
    } catch (error) {
      logger.error('Error updating profile', { error: error instanceof Error ? error : undefined })
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError('')

    if (file.size > 500 * 1024) {
      setPhotoError('La imagen debe ser menor a 500 KB.')
      logger.warn('Photo file too large', { size: file.size })
      return
    }

    if (!file.type.startsWith('image/')) {
      setPhotoError('Solo se permiten archivos de imagen (JPG, PNG, etc.).')
      logger.warn('Invalid file type for photo', { type: file.type })
      return
    }

    setUploadingPhoto(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const dataUrl = reader.result as string
        setPhotoURL(dataUrl)
        await updateUserProfile({ photoURL: dataUrl })
        setUploadingPhoto(false)
      }
      reader.onerror = () => {
        setPhotoError('Error al procesar la imagen. Intenta con otro archivo.')
        logger.error('Error reading photo file')
        setUploadingPhoto(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      setPhotoError('Error al subir la foto. Intenta nuevamente.')
      logger.error('Error uploading photo', { error: error instanceof Error ? error : undefined })
      setUploadingPhoto(false)
    }
  }

  const getRoleIcon = (rol?: UserRole) => {
    switch (rol) {
      case 'maestro': return Crown
      case 'admin': return Settings
      default: return User
    }
  }

  const RoleIcon = getRoleIcon(user.rol)
  const roleStyles = user.rol ? ROLE_STYLES[user.rol] : null
  const displayName = user.nombre || extractNameFromEmail(user.email)
  const firstInitial = displayName.trim().charAt(0).toUpperCase() || '?'
  const lastInitial = (user.apellido || '').trim().charAt(0).toUpperCase()
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
              <div className="relative group">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={`${user.nombre} ${user.apellido}`}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">
                      {firstInitial}{lastInitial}
                    </span>
                  </div>
                )}
                <label 
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Subir foto de perfil"
                >
                  <Camera className="w-6 h-6 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploadingPhoto}
                  />
                </label>
                {uploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              <div>
                <CardTitle className="text-2xl text-white">
                  {displayName} {user.apellido || ''}
                </CardTitle>
                <CardDescription className="text-base">{user.email}</CardDescription>
                {photoError && (
                  <p className="text-sm text-red-400 mt-1">{photoError}</p>
                )}
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
          {roleStyles && user.rol ? (
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
          ) : (
            <div className="p-4 rounded-lg bg-space-600/50">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gray-500/20">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Sin rol asignado. El usuario maestro te asignará un rol.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Team Selection */}
          <div className="p-4 rounded-lg bg-space-600/50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Equipo</p>
                {isEditing ? (
                  <select
                    value={equipo}
                    onChange={(e) => setEquipo(e.target.value as TeamType | '')}
                    title="Seleccionar equipo"
                    className="w-full px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">Selecciona tu equipo</option>
                    {Object.entries(TEAM_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white">
                    {user.equipo ? TEAM_LABELS[user.equipo] : 'No seleccionado — edita tu perfil para elegir equipo'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Gender Selection */}
          <div className="p-4 rounded-lg bg-space-600/50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-pink-500/20">
                <User className="w-6 h-6 text-pink-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Género</p>
                {isEditing ? (
                  <select
                    value={genero}
                    onChange={(e) => setGenero(e.target.value as Genero | '')}
                    title="Seleccionar género"
                    className="w-full px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">Selecciona tu género</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                ) : (
                  <p className="text-white">
                    {user.genero ? { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' }[user.genero] : 'No seleccionado — edita tu perfil para elegir género'}
                  </p>
                )}
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
                <p className="text-sm text-muted-foreground">Año Ingreso Carrera</p>
                {isEditing ? (
                  <Input 
                    value={year}
                    onChange={handleInputChange(setYear)}
                    placeholder="Ej: 2024"
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
            <h3 className="text-lg font-semibold text-white">Permisos</h3>
            <div className="grid gap-2">
              {user.rol === 'maestro' && (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4 text-orange-400" />
                    <span>Administración total del sistema</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4 text-orange-400" />
                    <span>Asignar roles y equipos a miembros</span>
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
                    <span>Asignar equipos a miembros</span>
                  </div>
                </>
              )}
              {(user.rol === 'maestro' || user.rol === 'admin' || user.equipo === 'manager') && (
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
              {!user.rol && !user.equipo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>Ver proyectos del equipo</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
