import { useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, MoreHorizontal, Send } from 'lucide-react'
import { Post, User, Comment } from '@/types'
import { extractNameFromEmail } from '@/lib/utils'
import { FeedService } from '@/sdk/FeedService'
import { CommentItem } from './CommentItem'
import { logger } from '@/lib/logger'

interface PostCardProps {
  post: Post
  author: User | undefined
  currentUserId: string
  usersMap: Record<string, User>
}

const CATEGORY_COLORS: Record<string, 'cyan' | 'orange' | 'secondary'> = {
  general: 'secondary',
  logro: 'cyan',
  duda: 'orange'
}

export function PostCard({ post, author, currentUserId, usersMap }: PostCardProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  
  const displayName = author?.nombre ? `${author.nombre} ${author.apellido || ''}`.trim() : extractNameFromEmail(author?.email || 'Usuario')
  const initial = displayName.charAt(0).toUpperCase()

  const loadComments = async () => {
    setIsLoadingComments(true)
    try {
      const fetched = await FeedService.getComments(post.id)
      setComments(fetched)
    } catch (error) {
      logger.error('Error loading comments', { error })
    } finally {
      setIsLoadingComments(false)
    }
  }

  const handleToggleComments = () => {
    if (!showComments && comments.length === 0) {
      loadComments()
    }
    setShowComments(!showComments)
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const id = await FeedService.createComment({
        postId: post.id,
        authorId: currentUserId,
        content: newComment.trim()
      })
      // Optimistic update
      setComments(prev => [...prev, {
        id,
        postId: post.id,
        authorId: currentUserId,
        content: newComment.trim(),
        createdAt: new Date(),
        isEdited: false
      }])
      setNewComment('')
    } catch (error) {
      logger.error('Error adding comment', { error })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditComment = async (commentId: string, newContent: string) => {
    try {
      await FeedService.updateComment(commentId, newContent)
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: newContent, isEdited: true, updatedAt: new Date() } : c))
    } catch (error) {
      logger.error('Error editing comment', { error })
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await FeedService.deleteComment(commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (error) {
      logger.error('Error deleting comment', { error })
    }
  }

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    let interval = seconds / 86400
    if (interval > 1) return Math.floor(interval) + 'd'
    interval = seconds / 3600
    if (interval > 1) return Math.floor(interval) + 'h'
    interval = seconds / 60
    if (interval > 1) return Math.floor(interval) + 'm'
    return 'ahora'
  }

  return (
    <Card className="bg-space-700/50 border-space-600 mb-4 transition-all duration-300 hover:border-cyan-500/30">
      <CardHeader className="p-4 sm:p-5 pb-0 flex flex-row items-start justify-between">
        <div className="flex items-center gap-3">
          {author?.photoURL ? (
            <img src={author.photoURL} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center font-bold text-white">
              {initial}
            </div>
          )}
          <div>
            <h3 className="text-white font-semibold text-sm sm:text-base">{displayName}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {author?.title && <span className="truncate max-w-[150px] sm:max-w-xs">{author.title} • </span>}
              <span>{timeAgo(post.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.category !== 'general' && (
            <Badge variant={CATEGORY_COLORS[post.category]} className="uppercase text-[10px]">
              {post.category}
            </Badge>
          )}
          {post.authorId === currentUserId && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-5">
        <p className="text-slate-200 text-sm sm:text-base whitespace-pre-wrap">{post.content}</p>
        
        {post.imageUrls && post.imageUrls.length > 0 && (
          <div className="mt-4 rounded-xl overflow-hidden border border-space-600">
            <img src={post.imageUrls[0]} alt="Post attachment" className="w-full max-h-[400px] object-cover" />
          </div>
        )}
      </CardContent>

      <CardFooter className="px-4 py-3 border-t border-space-600 flex flex-col gap-4">
        <div className="flex items-center gap-4 text-muted-foreground w-full">
          <button 
            onClick={handleToggleComments}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-cyan-400 ${showComments ? 'text-cyan-400' : ''}`}
          >
            <MessageCircle className="w-4 h-4" />
            Comentar
          </button>
        </div>

        {showComments && (
          <div className="w-full space-y-4 pt-2">
            {isLoadingComments ? (
              <div className="text-center text-sm text-muted-foreground py-2">Cargando comentarios...</div>
            ) : (
              <div className="space-y-1">
                {comments.map(comment => (
                  <CommentItem 
                    key={comment.id}
                    comment={comment}
                    author={usersMap[comment.authorId]}
                    currentUserId={currentUserId}
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                  />
                ))}
              </div>
            )}
            
            <div className="flex gap-3 items-end pt-2 border-t border-space-600/50">
              <div className="w-8 h-8 rounded-full bg-space-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                {usersMap[currentUserId]?.nombre?.charAt(0).toUpperCase() || 'Y'}
              </div>
              <div className="flex-1 relative">
                <Textarea 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="bg-space-800 border-space-600 text-white min-h-[40px] text-sm pr-12 resize-none py-3"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddComment()
                    }
                  }}
                  disabled={isSubmitting}
                />
                <Button 
                  size="icon" 
                  className="absolute right-2 bottom-2 h-8 w-8 bg-cyan-500 hover:bg-cyan-600 text-space-900 rounded-full"
                  disabled={!newComment.trim() || isSubmitting}
                  onClick={handleAddComment}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
