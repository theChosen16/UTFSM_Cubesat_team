import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { logger } from '@/lib/logger'

export interface AppSecrets {
  driveUploadUrl: string | null
  driveUploadSecret: string | null
}

/**
 * Hosts en los que puede vivir el bridge de Apps Script. Todo despliegue de Web App de Apps
 * Script se sirve desde uno de estos dos dominios.
 */
const ALLOWED_BRIDGE_HOSTS = ['script.google.com', 'script.googleusercontent.com']

/**
 * Valida el endpoint del bridge ANTES de que cualquier llamador le envíe datos.
 *
 * `driveUploadUrl` se lee de `system_config/keys`, un documento escribible desde la aplicación, y
 * el cliente le envía a esa URL el **ID token de Firebase del usuario** junto con los bytes de
 * cada archivo y el historial completo del chat (ver FileService.callBridge y
 * BotService.sendProxyMessage). Un valor manipulado convierte a cada navegador del equipo en un
 * exfiltrador: el ID token permite suplantar a esa persona frente a Firestore durante su vigencia,
 * de modo que quien pueda reescribir ese campo cosecha las credenciales efímeras de todo el
 * equipo, incluido el maestro. Por eso el destino se ancla aquí y, si no encaja, el bridge se
 * considera NO configurado (falla cerrado) en vez de usarse.
 *
 * En desarrollo se admite además un endpoint local para poder simular el bridge sin desplegarlo.
 */
function isTrustedBridgeUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }

  if (import.meta.env.DEV &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
    (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
    return true
  }

  return parsed.protocol === 'https:' && ALLOWED_BRIDGE_HOSTS.includes(parsed.hostname)
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
            if (!isTrustedBridgeUrl(driveUploadUrl)) {
              logger.error('Drive bridge URL rejected: host not allowed', { host: String(driveUploadUrl).slice(0, 120) })
              return { driveUploadUrl: null, driveUploadSecret: null }
            }
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

    if (envUrl && !isTrustedBridgeUrl(envUrl)) {
      logger.error('Drive bridge URL from env rejected: host not allowed', { host: envUrl.slice(0, 120) })
      return { driveUploadUrl: null, driveUploadSecret: null }
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
