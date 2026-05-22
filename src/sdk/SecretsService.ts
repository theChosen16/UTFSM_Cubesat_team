import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { logger } from '@/lib/logger'

export interface AppSecrets {
  driveUploadUrl: string | null
  driveUploadSecret: string | null
}

export class SecretsService {
  private static cachedSecrets: AppSecrets | null = null

  static async getSecrets(): Promise<AppSecrets> {
    // 1. Return cached secrets if available
    if (this.cachedSecrets) {
      return this.cachedSecrets
    }

    // 2. Try to fetch from Firestore if user is authenticated
    if (auth.currentUser) {
      try {
        const docRef = doc(db, 'system_config', 'keys')
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          const driveUploadUrl = data.driveUploadUrl || null
          const driveUploadSecret = data.driveUploadSecret || null

          if (driveUploadUrl && driveUploadSecret) {
            this.cachedSecrets = { driveUploadUrl, driveUploadSecret }
            return this.cachedSecrets
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch secrets from Firestore, falling back to env vars', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    // 3. Fallback to Vite environment variables (useful for local development or fallback config)
    let envUrl: string | undefined = undefined
    let envSecret: string | undefined = undefined

    if (import.meta.env.DEV) {
      envUrl = import.meta.env.VITE_DRIVE_UPLOAD_URL as string | undefined
      envSecret = import.meta.env.VITE_DRIVE_UPLOAD_SECRET as string | undefined
    }

    return {
      driveUploadUrl: envUrl || null,
      driveUploadSecret: envSecret || null
    }
  }

  static clearCache(): void {
    this.cachedSecrets = null
  }
}

// Clear cache autonomously when auth state changes (e.g. logout or user swap)
onAuthStateChanged(auth, () => {
  SecretsService.clearCache()
})
