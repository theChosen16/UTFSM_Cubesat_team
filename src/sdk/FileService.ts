import { addDoc, collection, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { COLLECTIONS } from '@/lib/constants'
import { db, auth } from '@/lib/firebase'
import { FileRecord } from '@/types'
import { logger } from '@/lib/logger'
import { ActivityLogService } from '@/sdk/ActivityLogService'
import { SecretsService } from './SecretsService'

const MAX_UPLOAD_BYTES = 35 * 1024 * 1024

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return new Date()
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result'))
        return
      }
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

interface DriveBridgeResponse {
  id?: string
  name?: string
  viewURL?: string
  downloadURL?: string
  size?: number
  mimeType?: string
  ok?: boolean
  error?: string
}

const callBridge = async (payload: Record<string, unknown>): Promise<DriveBridgeResponse> => {
  const secrets = await SecretsService.getSecrets()
  if (!secrets.driveUploadUrl || !secrets.driveUploadSecret) {
    throw new Error('drive-bridge-not-configured')
  }
  // Send a Firebase ID token so the bridge can derive the trusted uploader/owner email
  // server-side instead of relying on the spoofable client-supplied email.
  const idToken = auth.currentUser
    ? await auth.currentUser.getIdToken().catch(() => undefined)
    : undefined
  // Use text/plain to avoid CORS preflight on Apps Script web apps
  const response = await fetch(secrets.driveUploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: secrets.driveUploadSecret, idToken, ...payload }),
  })
  if (!response.ok) {
    throw new Error(`drive-bridge-http-${response.status}`)
  }
  const data = (await response.json()) as DriveBridgeResponse
  if (data.error) {
    throw new Error(`drive-bridge-${data.error}`)
  }
  return data
}

export class FileService {
  static isConfigured(): boolean {
    return Boolean(auth.currentUser || (import.meta.env.VITE_DRIVE_UPLOAD_URL && import.meta.env.VITE_DRIVE_UPLOAD_SECRET))
  }

  static async getAll(): Promise<FileRecord[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.FILES))
      return snapshot.docs
        .map(document => ({
          id: document.id,
          ...(document.data() as Omit<FileRecord, 'id' | 'createdAt'>),
          createdAt: toDate(document.data().createdAt),
        }))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    } catch (error) {
      logger.error('Error in FileService.getAll', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async upload(file: File, payload: {
    uploadedBy: string
    uploadedByEmail: string
    taskId?: string
    projectId?: string
    deliverableId?: string
  }): Promise<FileRecord> {
    if (!this.isConfigured()) {
      throw new Error('Drive uploads no están configurados. Pide al maestro configurar VITE_DRIVE_UPLOAD_URL.')
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const limit = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)
      throw new Error(`El archivo supera el límite de ${limit} MB.`)
    }

    try {
      const fileBase64 = await fileToBase64(file)

      const data = await callBridge({
        action: 'upload',
        userEmail: payload.uploadedByEmail,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileBase64,
        taskId: payload.taskId,
        projectId: payload.projectId,
        deliverableId: payload.deliverableId,
      })

      if (!data.id || !data.viewURL || !data.downloadURL) {
        throw new Error('drive-bridge-incomplete-response')
      }

      const metadata = {
        name: data.name || file.name,
        driveFileId: data.id,
        downloadURL: data.downloadURL,
        viewURL: data.viewURL,
        mimeType: data.mimeType || file.type || 'application/octet-stream',
        size: data.size ?? file.size,
        uploadedBy: payload.uploadedBy,
        taskId: payload.taskId || null,
        projectId: payload.projectId || null,
        deliverableId: payload.deliverableId || null,
        createdAt: Timestamp.now(),
      }

      const recordRef = await addDoc(collection(db, COLLECTIONS.FILES), metadata)

      await ActivityLogService.create({
        userId: payload.uploadedBy,
        type: 'deliverable_uploaded',
        relatedId: recordRef.id,
        taskId: payload.taskId,
        projectId: payload.projectId,
        deliverableId: payload.deliverableId,
        description: `Subió el archivo "${file.name}"`,
        metadata: {
          mimeType: metadata.mimeType,
          size: metadata.size,
        },
      }).catch(() => undefined)

      return {
        id: recordRef.id,
        name: metadata.name,
        driveFileId: metadata.driveFileId,
        downloadURL: metadata.downloadURL,
        viewURL: metadata.viewURL,
        mimeType: metadata.mimeType,
        size: metadata.size,
        uploadedBy: payload.uploadedBy,
        taskId: payload.taskId,
        projectId: payload.projectId,
        deliverableId: payload.deliverableId,
        createdAt: new Date(),
      }
    } catch (error) {
      logger.error('Error in FileService.upload', { error: error instanceof Error ? error : undefined, fileName: file.name })
      throw error
    }
  }

  /**
   * Borra un archivo del repositorio: primero el binario en Drive y sólo después su metadato.
   *
   * El orden y el fallo en cascada son deliberados. Cada archivo se publica en Drive como
   * *cualquiera con el enlace puede ver* (ver `handleUpload` en apps-script/Code.gs), y el bridge
   * sólo autoriza el borrado a quien lo subió: el email de confianza sale del ID token, no del
   * cliente. En cambio `firestore.rules` permite borrar el metadato tanto al autor como a
   * cualquier gestor del espacio de trabajo. Esas dos fronteras no coinciden, así que en el
   * camino normal —un manager limpiando el repositorio— la llamada al bridge devuelve
   * "unauthorized: you can only delete files you uploaded".
   *
   * Antes ese fallo se tragaba con un warning y el metadato se borraba igual. El resultado era
   * un archivo que la plataforma daba por eliminado y que seguía vivo en el Drive del equipo,
   * accesible para siempre por su URL pública, sin ningún puntero en Firestore: nadie podía ya
   * encontrarlo desde la aplicación ni volver a intentar borrarlo. Es decir, "eliminar" ocultaba
   * el documento sin retirar el acceso — exactamente lo contrario de lo que el usuario cree que
   * hizo, y el peor modo de fallo posible para un borrado. Ahora falla cerrado: si el binario
   * sigue en Drive, el metadato se conserva y el llamador recibe el error.
   */
  static async delete(record: FileRecord, actor: { email: string }): Promise<void> {
    try {
      if (this.isConfigured() && record.driveFileId) {
        await callBridge({
          action: 'delete',
          userEmail: actor.email,
          fileId: record.driveFileId,
        })
      }
      await deleteDoc(doc(db, COLLECTIONS.FILES, record.id))
    } catch (error) {
      logger.error('Error in FileService.delete', { error: error instanceof Error ? error : undefined, id: record.id })
      throw error
    }
  }
}
