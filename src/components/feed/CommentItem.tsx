import { useState } from 'react'
import { Comment, User } from '@/types'
import { extractNameFromEmail } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'

interface CommentItemProps {
  comment: Comment
  author: User | undefined
  currentUserId: string
  onEdit: (commentId: string, newContent: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}

export function CommentItem({ comment, author, currentUserId, onEdit, onDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAuthor = comment.authorId === currentUserId
  const displayName = author?.nombre ? `${author.nombre} ${author.apellido || ''}`.trim() : extractNameFromEmail(author?.email || 'Usuario')
  const initial = displayName.charAt(0).toUpperCase()

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false)
      return
    }
    setIsSubmitting(true)
    try {
      await onEdit(comment.id, editContent)
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
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
    <div className="flex gap-3 py-3 border-t border-space-600/50 group">
      {author?.photoURL ? (
        <img src={author.photoURL} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
          {initial}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="bg-space-800 rounded-2xl rounded-tl-none px-4 py-2 relative flex-1">
            <h4 className="text-white text-sm font-semibold mb-1">{displayName}</h4>
            
            {isEditing ? (
              <div className="mt-2">
                <Textarea 
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="bg-space-700 border-space-500 text-white min-h-[60px] text-sm mb-2"
                  disabled={isSubmitting}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditContent(comment.content) }} disabled={isSubmitting}>Cancelar</Button>
                  <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-space-900" onClick={handleSaveEdit} disabled={isSubmitting}>Guardar</Button>
                </div>
              </div>
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{comment.content}</p>
            )}
          </div>

          {isAuthor && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-space-800 border-space-600">
                <DropdownMenuItem onClick={() => setIsEditing(true)} className="text-white hover:bg-space-700 cursor-pointer">
                  <Edit2 className="w-4 h-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(comment.id)} className="text-red-400 hover:bg-red-500/20 cursor-pointer">
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {!isEditing && (
          <div className="flex items-center gap-3 mt-1 ml-1 text-xs text-muted-foreground">
            <span>{timeAgo(comment.createdAt)}</span>
            {comment.isEdited && <span>(editado)</span>}
          </div>
        )}
      </div>
    </div>
  )
}
