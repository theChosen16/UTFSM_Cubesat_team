import { ChangeEvent, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { UserService } from '@/sdk/UserService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
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
  Edit,
  GraduationCap,
  BookOpen,
  Heart,
  Clock,
  Briefcase,
  Save,
  Rocket,
  Camera,
  MessageSquare,
  ArrowLeft,
  Link as LinkIcon,
  Github
} from 'lucide-react'
import { UserRole, Questionnaire, TeamType, Genero, hasRole, hasAnyRole, hasTeam } from '@/types'
import { ROLE_LABELS, ROLE_DESCRIPTIONS, TEAM_LABELS } from '@/lib/ui-constants'
import { logger } from '@/lib/logger'
import { extractNameFromEmail, getRoleIcon, sanitizeUrl } from '@/lib/utils'
import { PortfolioGallery } from '@/components/profile/PortfolioGallery'

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
  const { userId } = useParams<{ userId?: string }>()
  const navigate = useNavigate()
  const { user, updateUserProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [viewedUser, setViewedUser] = useState<import('@/types').User | null>(null)
  const isOwnProfile = !userId || userId === user?.id
  const [viewLoading, setViewLoading] = useState(!isOwnProfile && Boolean(userId))
  const profileUser = isOwnProfile ? user : viewedUser
  
  // Profile fields
  const [syncedUserId, setSyncedUserId] = useState<string | undefined>(user?.id)
  const [career, setCareer] = useState(user?.career || '')
  const [year, setYear] = useState(user?.year || '')
  const [equipos, setEquipos] = useState<TeamType[]>(user?.equipos || [])
  const [genero, setGenero] = useState<Genero | ''>(user?.genero || '')
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [nombre, setNombre] = useState(user?.nombre || '')
  const [apellido, setApellido] = useState(user?.apellido || '')
  
  // Questionnaire fields
  const [intereses, setIntereses] = useState(user?.questionnaire?.intereses || '')
  const [habilidades, setHabilidades] = useState(user?.questionnaire?.habilidades || '')
  const [motivacion, setMotivacion] = useState(user?.questionnaire?.motivacion || '')
  const [disponibilidad, setDisponibilidad] = useState(user?.questionnaire?.disponibilidad || '')
  const [proyectosPrevios, setProyectosPrevios] = useState(user?.questionnaire?.proyectosPrevios || '')

  // Portfolio fields
  const [bio, setBio] = useState(user?.bio || '')
  const [title, setTitle] = useState(user?.title || '')
  const [linkedin, setLinkedin] = useState(user?.socialLinks?.linkedin || '')
  const [github, setGithub] = useState(user?.socialLinks?.github || '')
  const [portfolioImages, setPortfolioImages] = useState<string[]>(user?.portfolioImages || [])

  if (user && user.id !== syncedUserId) {
    setSyncedUserId(user.id)
    setCareer(user.career || '')
    setYear(user.year || '')
    setEquipos(user.equipos || [])
    setGenero(user.genero || '')
    setPhotoURL(user.photoURL || '')
    setNombre(user.nombre || '')
    setApellido(user.apellido || '')
    setIntereses(user.questionnaire?.intereses || '')
    setHabilidades(user.questionnaire?.habilidades || '')
    setMotivacion(user.questionnaire?.motivacion || '')
    setDisponibilidad(user.questionnaire?.disponibilidad || '')
    setProyectosPrevios(user.questionnaire?.proyectosPrevios || '')
    setBio(user.bio || '')
    setTitle(user.title || '')
    setLinkedin(user.socialLinks?.linkedin || '')
    setGithub(user.socialLinks?.github || '')
    setPortfolioImages(user.portfolioImages || [])
  }

  // Fetch other user's profile
  useEffect(() => {
    if (!isOwnProfile && userId) {
      const fetchUser = async () => {
        try {
          const fallbackUser = {
            id: userId,
            email: '',
            nombre: '',
            apellido: '',
            createdAt: new Date(),
            isActive: true
          }
          const fetchedUser = await UserService.getById(userId, fallbackUser)
          
          if (fetchedUser && fetchedUser.email !== '') {
            setViewedUser(fetchedUser)
          }
        } catch (error) {
          logger.error('Error fetching user profile', { error: error instanceof Error ? error : undefined, userId })
        } finally {
          setViewLoading(false)
        }
      }
      fetchUser()
    }
  }, [userId, isOwnProfile])

  if (!user) return null
  if (viewLoading) {
    return <Spinner />
  }
  if (!isOwnProfile && !viewedUser) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Usuario no encontrado.</p>
        <Button variant="ghost" className="mt-4 text-cyan-400" onClick={() => navigate('/members')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Miembros
        </Button>
      </div>
    )
  }

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
        nombre,
        apellido,
        career,
        year,
        equipos,
        bio,
        title,
        socialLinks: { linkedin, github },
        portfolioImages,
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

  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError('')

    if (file.size > 500 * 1024) {
      setPhotoError('La imagen debe ser menor a 500 KB.')
      logger.warn('Photo file too large', { size: file.size })
      return
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Solo se permiten imágenes JPG, PNG, GIF o WebP.')
      logger.warn('Invalid file type for photo', { type: file.type })
      return
    }

    setUploadingPhoto(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const dataUrl = reader.result as string
        // Verify the data URL prefix matches an allowed image type
        if (!dataUrl.startsWith('data:image/')) {
          setPhotoError('Formato de imagen inválido.')
          logger.warn('Unexpected data URL prefix for photo')
          setUploadingPhoto(false)
          return
        }
        // Guard against excessively large data URLs (~700 KB base64 ceiling for 500 KB file)
        if (dataUrl.length > 720 * 1024) {
          setPhotoError('La imagen procesada excede el tamaño permitido.')
          setUploadingPhoto(false)
          return
        }
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

  const displayName = (profileUser?.nombre) || extractNameFromEmail(profileUser?.email)
  const firstInitial = displayName.trim().charAt(0).toUpperCase() || '?'
  const lastInitial = (profileUser?.apellido || '').trim().charAt(0).toUpperCase()
  const handleInputChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(event.target.value)
  }

  return (
    <div className="page-shell max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4 animate-fade-in-up">
        {!isOwnProfile && (
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white" onClick={() => navigate('/members')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h1 className="page-title">{isOwnProfile ? 'Mi Perfil' : `Perfil de ${displayName}`}</h1>
          <p className="page-copy">
            {isOwnProfile ? 'Información personal y configuración de cuenta' : 'Información del miembro'}
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="bg-space-700/50 border-space-600">
        <CardHeader>
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            {/* Avatar */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="relative group">
                {profileUser?.photoURL ? (
                  <img 
                    src={profileUser.photoURL} 
                    alt={`${profileUser.nombre} ${profileUser.apellido}`}
                    loading="lazy"
                    className="w-20 h-20 rounded-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }}
                  />
                ) : null}
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center ${profileUser?.photoURL ? 'hidden' : ''}`}>
                    <span className="text-white font-bold text-2xl">
                      {firstInitial}{lastInitial}
                    </span>
                  </div>
                {isOwnProfile && (
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
                    title="Subir foto de perfil"
                  />
                </label>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-2xl text-white truncate">
                  {displayName} {profileUser?.apellido || ''}
                </CardTitle>
                <CardDescription className="text-base truncate">{profileUser?.email}</CardDescription>
                {photoError && (
                  <p className="text-sm text-red-400 mt-1" role="alert">{photoError}</p>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex w-full flex-col gap-2 md:ml-auto md:w-auto md:flex-row">
              {isOwnProfile ? (
                !isEditing ? (
                  <Button 
                    onClick={() => setIsEditing(true)}
                    variant="outline" 
                    className="w-full border-space-600 text-white hover:bg-space-600 md:w-auto"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Completar Cuestionario
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-cyan-500 text-space-900 hover:bg-cyan-600 md:w-auto"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                )
              ) : (
                <Button
                  onClick={() => navigate('/notifications', { state: { composeTo: profileUser?.id, composeToName: displayName } })}
                  className="w-full bg-cyan-500 text-space-900 hover:bg-cyan-600 md:w-auto"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Enviar Mensaje
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nombre/Apellido Editing (own profile only) */}
          {isOwnProfile && isEditing && (
            <div className="p-4 rounded-lg bg-space-600/50">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 rounded-xl bg-cyan-500/20">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-sm text-muted-foreground">Nombre y Apellido</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  value={nombre}
                  onChange={handleInputChange(setNombre)}
                  placeholder="Nombre"
                  className="bg-space-700 border-space-500 text-white text-sm"
                />
                <Input
                  value={apellido}
                  onChange={handleInputChange(setApellido)}
                  placeholder="Apellido"
                  className="bg-space-700 border-space-500 text-white text-sm"
                />
              </div>
            </div>
          )}

          {/* Professional Title & Bio */}
          {isOwnProfile && isEditing ? (
            <div className="p-4 rounded-lg bg-space-600/50 space-y-4">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <Briefcase className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm text-muted-foreground">Perfil Profesional</p>
              </div>
              <Input
                value={title}
                onChange={handleInputChange(setTitle)}
                placeholder="Título (Ej: Ingeniero de Software, Especialista Térmico)"
                className="bg-space-700 border-space-500 text-white text-sm"
              />
              <Textarea
                value={bio}
                onChange={handleInputChange(setBio)}
                placeholder="Escribe una breve biografía sobre ti y tus intereses..."
                className="bg-space-700 border-space-500 text-white text-sm min-h-[80px]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={linkedin}
                    onChange={handleInputChange(setLinkedin)}
                    placeholder="URL de LinkedIn"
                    className="pl-9 bg-space-700 border-space-500 text-white text-sm"
                  />
                </div>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={github}
                    onChange={handleInputChange(setGithub)}
                    placeholder="URL de GitHub"
                    className="pl-9 bg-space-700 border-space-500 text-white text-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            (profileUser?.title || profileUser?.bio) && (
              <div className="p-4 rounded-lg bg-space-600/50">
                {profileUser?.title && (
                  <h3 className="text-lg font-semibold text-white mb-2">{profileUser.title}</h3>
                )}
                {profileUser?.bio && (
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{profileUser.bio}</p>
                )}
                {(() => {
                  // Los enlaces sociales son texto libre controlado por el usuario. Se sanean para
                  // impedir XSS por `href` con esquemas peligrosos (javascript:, data:, etc.).
                  const linkedinUrl = sanitizeUrl(profileUser?.socialLinks?.linkedin)
                  const githubUrl = sanitizeUrl(profileUser?.socialLinks?.github)
                  if (!linkedinUrl && !githubUrl) return null
                  return (
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-space-500/50">
                      {linkedinUrl && (
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-sm">
                          <LinkIcon className="w-4 h-4" /> LinkedIn
                        </a>
                      )}
                      {githubUrl && (
                        <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-sm">
                          <Github className="w-4 h-4" /> GitHub
                        </a>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          )}

          {/* Role Section */}
          {profileUser?.rol ? (() => {
            const Icon = getRoleIcon(profileUser.rol)
            const styles = ROLE_STYLES[profileUser.rol]
            return (
              <div className="p-4 rounded-lg bg-space-600/50">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${styles.background}`}>
                    <Icon className={`w-6 h-6 ${styles.icon}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={styles.badge}>
                        {ROLE_LABELS[profileUser.rol]}
                      </Badge>
                      {profileUser.rol === 'maestro' && (
                        <Shield className="w-4 h-4 text-orange-400" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ROLE_DESCRIPTIONS[profileUser.rol]}
                    </p>
                  </div>
                </div>
              </div>
            )
          })() : (
            <div className="p-4 rounded-lg bg-space-600/50">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gray-500/20">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {isOwnProfile ? 'Sin rol asignado. El usuario maestro te asignará un rol.' : 'Sin rol asignado.'}
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
                <p className="text-sm text-muted-foreground mb-1">Equipos (máx. 2)</p>
                {isEditing ? (
                  <div className="space-y-2 mt-2">
                    {Object.entries(TEAM_LABELS).map(([key, label]) => {
                      const teamKey = key as TeamType
                      const checked = equipos.includes(teamKey)
                      const disabled = !checked && equipos.length >= 2
                      return (
                        <label key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-space-700 border border-space-500 text-sm cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-cyan-500'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => {
                              if (checked) {
                                setEquipos(equipos.filter(t => t !== teamKey))
                              } else if (equipos.length < 2) {
                                setEquipos([...equipos, teamKey])
                              }
                            }}
                            className="accent-cyan-500"
                            title={`Seleccionar equipo ${label}`}
                          />
                          <span className="text-white">{label}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-white">
                    {profileUser?.equipos && profileUser.equipos.length > 0 
                      ? profileUser.equipos.map(t => TEAM_LABELS[t]).join(', ') 
                      : isOwnProfile ? 'No seleccionado — edita tu perfil para elegir equipo' : 'Sin equipo asignado'}
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
                    className="min-h-11 w-full rounded-xl border border-space-500 bg-space-700 px-3 text-base text-white focus:border-cyan-500 focus:outline-none sm:text-sm"
                  >
                    <option value="">Selecciona tu género</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                ) : (
                  <p className="text-white">
                    {profileUser?.genero ? { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' }[profileUser.genero] : isOwnProfile ? 'No seleccionado — edita tu perfil para elegir género' : 'No especificado'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="region" aria-label="Información del perfil">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-space-600/50">
              <Mail className="w-5 h-5 text-cyan-400" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Correo electrónico</p>
                <p className="text-white">{profileUser?.email}</p>
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
                    className="mt-2 bg-space-700 border-space-500 text-white"
                  />
                ) : (
                  <p className="text-white">{profileUser?.career || 'No especificada'}</p>
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
                    className="mt-2 bg-space-700 border-space-500 text-white"
                  />
                ) : (
                  <p className="text-white">{profileUser?.year || 'No especificado'}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-space-600/50">
              <Calendar className="w-5 h-5 text-orange-400" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Miembro desde</p>
                <p className="text-white">
                  {profileUser?.createdAt instanceof Date 
                    ? profileUser.createdAt.toLocaleDateString('es-CL', { 
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

          {/* Portfolio Gallery Component */}
          <div className="pt-4 border-t border-space-600">
            <PortfolioGallery 
              images={isOwnProfile ? portfolioImages : profileUser?.portfolioImages || []}
              isOwnProfile={isOwnProfile}
              onAddImage={
                isOwnProfile ? (url) => {
                  const newImages = [...portfolioImages, url]
                  setPortfolioImages(newImages)
                  updateUserProfile({ portfolioImages: newImages })
                } : undefined
              }
              onRemoveImage={
                isOwnProfile ? (idx) => {
                  const newImages = portfolioImages.filter((_, i) => i !== idx)
                  setPortfolioImages(newImages)
                  updateUserProfile({ portfolioImages: newImages })
                } : undefined
              }
            />
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
                    {profileUser?.questionnaire?.intereses || 'Aún no respondido.'}
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
                    {profileUser?.questionnaire?.habilidades || 'Aún no respondido.'}
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
                    {profileUser?.questionnaire?.motivacion || 'Aún no respondido.'}
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
                    {profileUser?.questionnaire?.disponibilidad || 'Aún no respondido.'}
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
                    {profileUser?.questionnaire?.proyectosPrevios || 'Aún no respondido.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Permissions (own profile only) */}
          {isOwnProfile && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Permisos</h3>
            <div className="grid gap-2">
              {hasRole(user, 'maestro') && (
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
              {hasRole(user, 'admin') && (
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
              {(hasAnyRole(user, 'maestro', 'admin') || hasTeam(user, 'manager')) && (
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
              {!user?.rol && (!user?.equipos || user.equipos.length === 0) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>Ver proyectos del equipo</span>
                </div>
              )}
            </div>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
