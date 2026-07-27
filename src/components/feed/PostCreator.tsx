import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Image as ImageIcon, Send, AlertTriangle } from 'lucide-react'
import { PostCategory } from '@/types'

const MAX_IMAGE_SIZE_BYTES = 500 * 1024 // 500KB — base64 inflates ~33%, keeping under Firestore 1MB doc limit

interface PostCreatorProps {
  onPostCreated: (content: string, category: PostCategory, imageUrls: string[]) => Promise<void>
}

export function PostCreator({ onPostCreated }: PostCreatorProps) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<PostCategory>('general')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(`La imagen es demasiado grande (${(file.size / 1024).toFixed(0)}KB). Máximo permitido: ${MAX_IMAGE_SIZE_BYTES / 1024}KB.`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setImageUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!content.trim() && !imageUrl) return
    setIsSubmitting(true)
    setError(null)
    try {
      await onPostCreated(content, category, imageUrl ? [imageUrl] : [])
      setContent('')
      setImageUrl('')
      setCategory('general')
    } catch {
      setError('Error al publicar. La imagen puede ser demasiado grande para almacenar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="bg-space-700/50 border-space-600 mb-6">
      <CardContent className="p-4 sm:p-6">
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="¿Qué quieres compartir con el equipo?"
          className="bg-space-800 border-space-600 text-white min-h-[100px] mb-4 resize-none"
          disabled={isSubmitting}
        />
        
        {imageUrl && (
          <div className="relative mb-4 w-32 h-32 rounded-lg overflow-hidden border border-space-600">
            <img src={imageUrl} alt="Upload preview" className="w-full h-full object-cover" />
            <button 
              onClick={() => setImageUrl('')}
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer text-cyan-400 hover:text-cyan-300 flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-space-600/50 transition-colors">
              <ImageIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Añadir Foto</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isSubmitting} />
            </label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PostCategory)}
              className="bg-space-800 border border-space-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
              disabled={isSubmitting}
            >
              <option value="general">General</option>
              <option value="logro">Logro / Hito</option>
              <option value="duda">Duda Técnica</option>
              <option value="oportunidad">Oportunidad</option>
            </select>
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={(!content.trim() && !imageUrl) || isSubmitting}
            className="bg-cyan-500 text-space-900 hover:bg-cyan-600 font-semibold"
          >
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Publicando...' : 'Publicar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
