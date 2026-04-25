/** Firestore collection names — single source of truth */
export const COLLECTIONS = {
  USERS: 'users',
  PROJECTS: 'projects',
  TASKS: 'tasks',
  FILES: 'files',
  ACTIVITY_LOG: 'activity_log',
  MEMBER_SCORES: 'member_scores',
  NOTIFICATIONS: 'notifications',
} as const

/** Valid institutional email domains for registration */
export const VALID_EMAIL_DOMAINS = ['@usm.cl', '@sansano.usm.cl'] as const
