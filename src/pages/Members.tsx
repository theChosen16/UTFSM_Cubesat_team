import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Shield, 
  Cpu, 
  Users, 
  Globe,
  Search,
  MoreHorizontal,
  Crown,
  Settings
} from 'lucide-react'
import { User as UserType, ROLE_LABELS, UserRole, TEAM_LABELS, TeamType } from '@/types'
import { logger } from '@/lib/logger'
import { extractNameFromEmail } from '@/lib/utils'

export default function Members() {
  const { user, getAllUsers, updateUserRole, updateUserTeam } = useAuth()
  const [members, setMembers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    try {
      const users = await getAllUsers()
      setMembers(users)
    } catch (error) {
      logger.error('Error loading members', { error: error instanceof Error ? error : undefined })
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    // Only maestro can assign admin roles
    if (user?.rol !== 'maestro') {
      logger.warn('Non-maestro user attempted to assign role', { userId, newRole })
      return
    }
    try {
      await updateUserRole(userId, newRole)
      await loadMembers()
    } catch (error) {
      logger.error('Error updating role', { error: error instanceof Error ? error : undefined, userId, newRole })
    }
  }

  const handleTeamChange = async (userId: string, newTeam: TeamType) => {
    try {
      await updateUserTeam(userId, newTeam)
      await loadMembers()
    } catch (error) {
      logger.error('Error updating team', { error: error instanceof Error ? error : undefined, userId, newTeam })
    }
  }

  const getRoleIcon = (rol?: UserRole) => {
    switch (rol) {
      case 'maestro': return Crown
      case 'admin': return Settings
      default: return User
    }
  }

      const filteredMembers = members.filter(member =>
    (member.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.apellido || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getMemberDisplayName = (member: UserType) => {
    if (member.nombre) return `${member.nombre} ${member.apellido || ''}`
    return extractNameFromEmail(member.email)
  }

  const getMemberInitials = (member: UserType) => {
    if (member.nombre) {
      const first = member.nombre.trim().charAt(0).toUpperCase() || '?'
      const last = (member.apellido || '').trim().charAt(0).toUpperCase()
      return last ? `${first}${last}` : first
    }
    const extracted = extractNameFromEmail(member.email)
    return extracted.charAt(0).toUpperCase() || '?'
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
          <h1 className="text-3xl font-bold text-white">Miembros del Equipo</h1>
          <p className="text-muted-foreground mt-1">
            Directorio de miembros y sus funciones en el equipo
          </p>
        </div>
        {(user?.rol === 'maestro' || user?.rol === 'admin') && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-orange-400" />
            <span>Gestión de roles habilitada</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar miembros..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-space-700 border border-space-600 text-white placeholder:text-muted-foreground focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Members Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMembers.map((member) => {
          const RoleIcon = getRoleIcon(member.rol)
          const isCurrentUser = user?.id === member.id
          const isMaster = user?.rol === 'maestro'

          return (
            <Card key={member.id} className="bg-space-700/50 border-space-600">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {member.photoURL ? (
                      <img 
                        src={member.photoURL} 
                        alt={`${member.nombre} ${member.apellido}`}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {getMemberInitials(member)}
                        </span>
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg text-white">
                        {getMemberDisplayName(member)}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-cyan-400">(Tú)</span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-sm">{member.email}</CardDescription>
                    </div>
                  </div>
                  {isMaster && !isCurrentUser && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show admin/maestro badge only for those roles */}
                {member.rol === 'maestro' && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/20">
                      <RoleIcon className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <Badge variant="orange">
                        {ROLE_LABELS[member.rol]}
                      </Badge>
                    </div>
                  </div>
                )}
                {member.rol === 'admin' && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/20">
                      <RoleIcon className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <Badge variant="red">
                        {ROLE_LABELS[member.rol]}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Team info — always shown */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Equipo: <span className="text-white">{member.equipo ? TEAM_LABELS[member.equipo] : 'Sin equipo asignado'}</span></span>
                </div>

                {/* Role Change (Maestro can assign Admin) */}
                {isMaster && !isCurrentUser && (
                  <div className="pt-3 border-t border-space-600">
                    <label className="text-xs text-muted-foreground mb-2 block">Asignar rol:</label>
                    <select
                      value={member.rol || ''}
                      onChange={(e) => {
                        const val = e.target.value as UserRole
                        if (val) handleRoleChange(member.id, val)
                      }}
                      title="Cambiar rol del miembro"
                      className="w-full px-3 py-2 rounded-lg bg-space-600 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">Sin rol</option>
                      <option value="admin">Administrador</option>
                      <option value="maestro">Usuario Maestro</option>
                    </select>
                  </div>
                )}

                {/* Team Assignment (Maestro or Admin) */}
                {(isMaster || user?.rol === 'admin') && !isCurrentUser && (
                  <div className="pt-3 border-t border-space-600">
                    <label className="text-xs text-muted-foreground mb-2 block">Asignar equipo:</label>
                    <select
                      value={member.equipo || ''}
                      onChange={(e) => {
                        const val = e.target.value as TeamType
                        if (val) handleTeamChange(member.id, val)
                      }}
                      title="Cambiar equipo del miembro"
                      className="w-full px-3 py-2 rounded-lg bg-space-600 border border-space-500 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">Sin equipo</option>
                      <option value="tecnico">Equipo Técnico</option>
                      <option value="manager">Manager</option>
                      <option value="relaciones_publicas">Relaciones Públicas</option>
                    </select>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No se encontraron miembros</p>
        </div>
      )}
    </div>
  )
}
