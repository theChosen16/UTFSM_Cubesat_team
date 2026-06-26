import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { Post, Comment } from '@/types'
import { logger } from '@/lib/logger'

export class FeedService {
  static async getPosts(): Promise<Post[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.POSTS),
        orderBy('createdAt', 'desc')
      )
      const snap = await getDocs(q)
      return snap.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          authorId: data.authorId || '',
          content: data.content || '',
          category: data.category || 'general',
          imageUrls: data.imageUrls || [],
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Post
      })
    } catch (error) {
      logger.error('Error fetching posts', { error: error instanceof Error ? error : undefined })
      return []
    }
  }

  static async createPost(data: Omit<Post, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.POSTS), {
        ...data,
        createdAt: serverTimestamp()
      })
      return docRef.id
    } catch (error) {
      logger.error('Error creating post', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async getComments(postId: string): Promise<Comment[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.COMMENTS),
        where('postId', '==', postId),
        orderBy('createdAt', 'asc')
      )
      const snap = await getDocs(q)
      return snap.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          postId: data.postId || '',
          authorId: data.authorId || '',
          content: data.content || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.(),
          isEdited: data.isEdited || false,
        } as Comment
      })
    } catch (error) {
      logger.error('Error fetching comments', { error: error instanceof Error ? error : undefined, postId })
      return []
    }
  }

  static async createComment(data: Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'isEdited'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.COMMENTS), {
        ...data,
        createdAt: serverTimestamp(),
        isEdited: false
      })
      return docRef.id
    } catch (error) {
      logger.error('Error creating comment', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  static async updateComment(commentId: string, content: string): Promise<void> {
    try {
      const commentRef = doc(db, COLLECTIONS.COMMENTS, commentId)
      await updateDoc(commentRef, {
        content,
        updatedAt: serverTimestamp(),
        isEdited: true
      })
    } catch (error) {
      logger.error('Error updating comment', { error: error instanceof Error ? error : undefined, commentId })
      throw error
    }
  }

  static async deleteComment(commentId: string): Promise<void> {
    try {
      const commentRef = doc(db, COLLECTIONS.COMMENTS, commentId)
      await deleteDoc(commentRef)
    } catch (error) {
      logger.error('Error deleting comment', { error: error instanceof Error ? error : undefined, commentId })
      throw error
    }
  }
}
