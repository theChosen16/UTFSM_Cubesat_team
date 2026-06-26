import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Camera, Plus, X, Image as ImageIcon } from 'lucide-react'

interface PortfolioGalleryProps {
  images: string[]
  isOwnProfile: boolean
  onAddImage?: (imageUrl: string) => void
  onRemoveImage?: (index: number) => void
}

export function PortfolioGallery({ images, isOwnProfile, onAddImage, onRemoveImage }: PortfolioGalleryProps) {
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      if (onAddImage) {
        onAddImage(dataUrl)
      }
      setUploading(false)
    }
    reader.onerror = () => {
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <Card className="bg-space-700/50 border-space-600">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-cyan-400" />
            Portafolio Visual
          </CardTitle>
          <CardDescription>Proyectos, logros y trabajo en el taller</CardDescription>
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
                disabled={uploading}
              />
            </label>
          </div>
        )}
      </CardHeader>
      <CardContent>
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
