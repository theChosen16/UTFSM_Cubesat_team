import { ActivityLogEntry, Task } from '@/types'

export interface MemberPerformance {
  completedCount: number
  pendingCount: number
  totalScore: number
  activityCount: number
  lastActivity?: ActivityLogEntry
  recentActivities: ActivityLogEntry[]
}

export const getMemberRankInfo = (totalScore: number) => {
  if (totalScore === 0) return { label: 'Aportador Inicial', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  if (totalScore <= 15) return { label: 'Miembro Activo', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' }
  if (totalScore <= 40) return { label: 'Especialista de Equipo', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
  return { label: 'Líder de Iniciativas', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
}

const completedByMember = (task: Task, memberId: string) => {
  if (task.completedBy) return task.completedBy === memberId
  return task.estado === 'completado' && task.asignadoA.includes(memberId)
}

export const buildMemberPerformance = (memberId: string, tasks: Task[], activities: ActivityLogEntry[]): MemberPerformance => {
  const completedTasks = tasks.filter(task => task.estado === 'completado' && completedByMember(task, memberId))
  const pendingTasks = tasks.filter(task => task.estado !== 'completado' && task.asignadoA.includes(memberId))
  const memberActivities = activities
    .filter(activity => activity.userId === memberId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

  return {
    completedCount: completedTasks.length,
    pendingCount: pendingTasks.length,
    totalScore: completedTasks.reduce((sum, task) => sum + (task.scoreAwarded ?? task.puntajeImportancia ?? 0), 0),
    activityCount: memberActivities.length,
    lastActivity: memberActivities[0],
    recentActivities: memberActivities.slice(0, 3),
  }
}