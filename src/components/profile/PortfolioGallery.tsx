import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Camera, Plus, X, Image as ImageIcon, AlertTriangle } from 'lucide-react'

const MAX_PORTFOLIO_IMAGES = 8
const MAX_IMAGE_SIZE_BYTES = 200 * 1024 // 200KB per image after compression
const MAX_PORTFOLIO_TOTAL_BYTES = 900 * 1024 // 900KB total to stay under 1MB doc limit
const COMPRESS_MAX_WIDTH = 1200
const COMPRESS_QUALITY = 0.7

/**
 * Compresses an image file using Canvas API.
 * Returns a base64 data URL (JPEG) that fits within size limits.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      if (width > COMPRESS_MAX_WIDTH) {
        height = Math.round((height * COMPRESS_MAX_WIDTH) / width)
        width = COMPRESS_MAX_WIDTH
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto de canvas'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', COMPRESS_QUALITY)
      resolve(dataUrl)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Error al cargar la imagen'))
    }

    img.src = objectUrl
  })
}

interface PortfolioGalleryProps {
  images: string[]
  isOwnProfile: boolean
  onAddImage?: (imageUrl: string) => void
  onRemoveImage?: (index: number) => void
}

export function PortfolioGallery({ images, isOwnProfile, onAddImage, onRemoveImage }: PortfolioGalleryProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentTotalBytes = images.reduce((sum, img) => sum + img.length, 0)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetInput = e.target
    const file = targetInput.files?.[0]
    if (!file) return

    setError(null)

    // Validate image count
    if (images.length >= MAX_PORTFOLIO_IMAGES) {
      setError(`Máximo ${MAX_PORTFOLIO_IMAGES} imágenes en el portafolio.`)
      targetInput.value = ''
      return
    }

    setUploading(true)
    try {
      const dataUrl = await compressImage(file)

      // Validate compressed image size
      if (dataUrl.length > MAX_IMAGE_SIZE_BYTES) {
        setError('La imagen es demasiado grande incluso después de comprimirla. Intenta con una imagen más pequeña (< 1MB).')
        return
      }

      // Validate total portfolio size
      if (currentTotalBytes + dataUrl.length > MAX_PORTFOLIO_TOTAL_BYTES) {
        setError('El portafolio ha alcanzado su límite de almacenamiento. Elimina alguna imagen antes de agregar más.')
        return
      }

      if (onAddImage) {
        onAddImage(dataUrl)
      }
    } catch {
      setError('Error al procesar la imagen. Intenta con otro archivo.')
    } finally {
      setUploading(false)
      targetInput.value = ''
    }
  }

  return (
    <Card className="bg-space-700/50 border-space-600">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-cyan-400" />
            Portafolio Visual
          </CardTitle>
          <CardDescription>Proyectos, logros y trabajo en el taller ({images.length}/{MAX_PORTFOLIO_IMAGES})</CardDescription>
        </div>
        {isOwnProfile && (
          <div>
            <label className="cursor-pointer">
              <div className="flex items-center gap-2 rounded-lg bg-space-600 px-3 py-2 text-sm font-medium text-white hover:bg-space-500 transition-colors">
                {uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Añadir Imagen
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading || images.length >= MAX_PORTFOLIO_IMAGES}
              />
            </label>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-space-600 rounded-xl">
            <Camera className="w-10 h-10 text-space-400 mb-3" />
            <p className="text-muted-foreground text-sm max-w-sm">
              {isOwnProfile 
                ? 'Sube fotos de tus proyectos, eventos o trabajo en el taller para mostrar tu experiencia.' 
                : 'Este usuario aún no ha subido imágenes a su portafolio.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img, idx) => (
              <div key={idx} className="group relative aspect-video rounded-xl overflow-hidden bg-space-800 border border-space-600">
                <img 
                  src={img} 
                  alt={`Portfolio image ${idx + 1}`} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {isOwnProfile && onRemoveImage && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                      variant="destructive" 
                      size="icon"
                      onClick={() => onRemoveImage(idx)}
                      className="w-8 h-8 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

