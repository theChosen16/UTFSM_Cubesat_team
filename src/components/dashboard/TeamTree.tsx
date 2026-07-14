import { User as UserType, hasRole, hasTeam } from '@/types'
import { ROLE_LABELS } from '@/lib/ui-constants'
import { extractNameFromEmail } from '@/lib/utils'
import { Cpu, Users, Globe, Crown } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface TeamTreeProps {
  members: UserType[]
}

const TEAM_ICON_MAP: Record<string, { icon: any; colorClass: string; bgClass: string; borderClass: string }> = {
  directiva: { icon: Crown, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/20', borderClass: 'border-amber-500/30' },
  tecnico: { icon: Cpu, colorClass: 'text-purple-400', bgClass: 'bg-purple-500/20', borderClass: 'border-purple-500/30' },
  manager: { icon: Users, colorClass: 'text-cyan-400', bgClass: 'bg-cyan-500/20', borderClass: 'border-cyan-500/30' },
  relaciones_publicas: { icon: Globe, colorClass: 'text-green-400', bgClass: 'bg-green-500/20', borderClass: 'border-green-500/30' },
}

export function TeamTree({ members }: TeamTreeProps) {
  // 1. Filter out directiva (admins/maestros)
  const directiva = members.filter(m => hasRole(m, 'admin') || hasRole(m, 'maestro'))
  
  // 2. Filter teams (allow members to be part of multiple nodes)
  const tecnico = members.filter(m => hasTeam(m, 'tecnico'))
  const manager = members.filter(m => hasTeam(m, 'manager'))
  const rrpp = members.filter(m => hasTeam(m, 'relaciones_publicas'))

  const renderMemberNode = (member: UserType) => {
    const displayName = member.nombre ? `${member.nombre} ${member.apellido || ''}`.trim() : extractNameFromEmail(member.email)
    const initial = displayName.charAt(0).toUpperCase()
    
    return (
      <div key={member.id || member.email} className="relative group flex flex-col items-center transition-transform hover:scale-110 z-10">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-space-500 bg-space-800 shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:border-cyan-400 transition-colors">
          {member.photoURL ? (
            <img src={member.photoURL} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-600 to-purple-600 flex items-center justify-center font-bold text-white text-lg">
              {initial}
            </div>
          )}
        </div>
        <div className="mt-2 text-center absolute top-full pt-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-32 bg-space-900/90 rounded border border-space-600 p-1.5 shadow-xl backdrop-blur-sm z-20">
          <p className="text-xs font-bold text-white leading-tight">{displayName}</p>
          <p className="text-[10px] text-cyan-400 truncate">{member.title || (member.rol ? ROLE_LABELS[member.rol] : 'Miembro')}</p>
        </div>
      </div>
    )
  }

  const renderTeamSection = (title: string, teamKey: string, teamMembers: UserType[]) => {
    const config = TEAM_ICON_MAP[teamKey]
    const Icon = config.icon

    return (
      <div className="flex flex-col items-center flex-1 min-w-[250px] w-full max-w-sm relative mt-8 lg:mt-0">
        {/* Connection line from top to team header */}
        <div className="hidden lg:block absolute -top-8 left-1/2 w-0.5 h-8 bg-gradient-to-b from-cyan-500/50 to-transparent -translate-x-1/2" />
        
        <Card className={`bg-space-800/80 backdrop-blur-sm border ${config.borderClass} p-4 w-full flex flex-col items-center relative z-10 shadow-lg shadow-black/20`}>
          <div className={`w-10 h-10 rounded-xl ${config.bgClass} flex items-center justify-center mb-3 shadow-[0_0_15px_currentColor] ${config.colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-white font-bold text-sm tracking-wider uppercase mb-1">{title}</h3>
          <span className="text-xs text-muted-foreground mb-4">{teamMembers.length} miembro{teamMembers.length !== 1 ? 's' : ''}</span>
          
          <div className="flex flex-wrap justify-center gap-3">
            {teamMembers.map(renderMemberNode)}
            {teamMembers.length === 0 && (
              <span className="text-xs text-space-500 italic py-2">Vacante</span>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full relative py-6">
      <div className="w-full flex flex-col items-center">
        
        {/* Directiva / Root Node */}
        <div className="flex flex-col items-center relative z-10 mb-8">
          <div className="bg-space-800/90 backdrop-blur-md border border-amber-500/40 rounded-2xl p-5 shadow-[0_0_30px_rgba(245,158,11,0.1)] flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-amber-400" />
              <h2 className="text-amber-400 font-bold uppercase tracking-widest text-sm">Directiva / Core</h2>
            </div>
            <div className="flex justify-center gap-4">
              {directiva.map(renderMemberNode)}
              {directiva.length === 0 && (
                <span className="text-xs text-space-500 italic py-2">No hay directiva asignada</span>
              )}
            </div>
          </div>
          
          {/* Main vertical stem */}
          <div className="w-0.5 h-8 bg-cyan-500/50 mt-0 relative">
            <div className="absolute inset-0 bg-cyan-400 blur-[2px] animate-pulse" />
          </div>
        </div>

        {/* Horizontal connector line for the 3 teams (Desktop only visually) */}
        <div className="w-3/4 max-w-4xl border-t-2 border-cyan-500/30 relative hidden lg:block">
           <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 blur-[2px] opacity-50" />
           {/* Ends of the horizontal line */}
           <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
           <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
           <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#06b6d4]" />
        </div>

        {/* Teams Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-start justify-center gap-6 lg:gap-8 w-full max-w-6xl px-4 mt-0 lg:-mt-[2px] relative z-10">
          {renderTeamSection('Técnico', 'tecnico', tecnico)}
          {renderTeamSection('Management', 'manager', manager)}
          {renderTeamSection('RR.PP.', 'relaciones_publicas', rrpp)}
        </div>

      </div>
    </div>
  )
}
