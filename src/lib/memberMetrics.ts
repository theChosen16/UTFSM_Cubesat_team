import { ActivityLogEntry, Task } from '@/types'

export interface MemberPerformance {
  completedCount: number
  inProgressCount: number
  pendingCount: number
  activityCount: number
  lastActivity?: ActivityLogEntry
  recentActivities: ActivityLogEntry[]
}

const completedByMember = (task: Task, memberId: string) => {
  if (task.completedBy) return task.completedBy === memberId
  return task.estado === 'completado' && task.asignadoA.includes(memberId)
}

export const buildMemberPerformance = (memberId: string, tasks: Task[], activities: ActivityLogEntry[]): MemberPerformance => {
  const memberTasks = tasks.filter(task => task.asignadoA.includes(memberId))
  const completedTasks = tasks.filter(task => task.estado === 'completado' && completedByMember(task, memberId))
  const inProgressTasks = memberTasks.filter(task => task.estado === 'en_progreso')
  const pendingTasks = memberTasks.filter(task => task.estado === 'pendiente')

  const memberActivities = activities
    .filter(activity => activity.userId === memberId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

  return {
    completedCount: completedTasks.length,
    inProgressCount: inProgressTasks.length,
    pendingCount: pendingTasks.length,
    activityCount: memberActivities.length,
    lastActivity: memberActivities[0],
    recentActivities: memberActivities.slice(0, 3),
  }
}