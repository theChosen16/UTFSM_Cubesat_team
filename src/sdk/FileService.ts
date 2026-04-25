import { addDoc, collection, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { COLLECTIONS } from '@/lib/constants'
import { db, storage } from '@/lib/firebase'
import { FileRecord } from '@/types'
import { logger } from '@/lib/logger'
import { ActivityLogService } from '@/sdk/ActivityLogService'

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return new Date()
}

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_')

export class FileService {
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
    taskId?: string
    projectId?: string
    deliverableId?: string
  }): Promise<FileRecord> {
    try {
      const scope = payload.taskId || payload.projectId || payload.deliverableId || 'general'
      const storagePath = `files/${scope}/${Date.now()}-${sanitizeFileName(file.name)}`
      const storageRef = ref(storage, storagePath)

      await uploadBytes(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          uploadedBy: payload.uploadedBy,
          taskId: payload.taskId || '',
          projectId: payload.projectId || '',
          deliverableId: payload.deliverableId || '',
        },
      })
      const downloadURL = await getDownloadURL(storageRef)

      const metadata = {
        name: file.name,
        storagePath,
        downloadURL,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedBy: payload.uploadedBy,
        taskId: payload.taskId || undefined,
        projectId: payload.projectId || undefined,
        deliverableId: payload.deliverableId || undefined,
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
      })

      return {
        id: recordRef.id,
        ...metadata,
        createdAt: new Date(),
      }
    } catch (error) {
      logger.error('Error in FileService.upload', { error: error instanceof Error ? error : undefined, fileName: file.name })
      throw error
    }
  }

  static async delete(record: FileRecord): Promise<void> {
    try {
      await Promise.all([
        deleteDoc(doc(db, COLLECTIONS.FILES, record.id)),
        deleteObject(ref(storage, record.storagePath)),
      ])
    } catch (error) {
      logger.error('Error in FileService.delete', { error: error instanceof Error ? error : undefined, id: record.id })
      throw error
    }
  }
}