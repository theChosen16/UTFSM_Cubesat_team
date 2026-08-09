import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserService } from '@/sdk/UserService'
import { Button } from '@/components/ui/button'
import { Rocket, Users, FolderKanban, ListTodo, ChevronRight, ChevronLeft, X } from 'lucide-react'
import { logger } from '@/lib/logger'

const ONBOARDING_SLIDES = [
  {
    id: 'welcome',
    title: 'Bienvenido a Cubesat Base',
    description: 'El centro de control y coordinación de nuestro equipo. Aquí podrás ver el estado de la misión en tiempo real a través del Dashboard y el tracking de actividades por sub-equipo.',
    icon: Rocket,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20'
  },
  {
    id: 'feed',
    title: 'Comunidad (Feed)',
    description: 'Comparte logros, dudas y actualizaciones. Interactúa y comenta con los demás integrantes en un entorno exclusivo para nosotros.',
    icon: Users,
    color: 'text-purple-400',
    bg: 'bg-purple-500/20'
  },
  {
    id: 'projects',
    title: 'Proyectos & Chats',
    description: 'Explora los proyectos activos. Entra al Chat de Proyecto para coordinar entregas, subir archivos y mantener el historial (preparado para integración con IA).',
    icon: FolderKanban,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20'
  },
  {
    id: 'tasks',
    title: 'Tareas & Progreso',
    description: 'Cumple hitos y entrega tareas asignadas. El progreso y la actividad de tu sub-equipo se reflejará en tiempo real en la plataforma.',
    icon: ListTodo,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20'
  }
]

export function OnboardingGuide() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => {
    // Only show if the user explicitly has hasSeenOnboarding as false or undefined
    if (user && user.hasSeenOnboarding !== true) {
      // Add a small delay so it doesn't pop immediately over loading screens
      const timer = setTimeout(() => setIsOpen(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [user])

  if (!isOpen || !user) return null

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      await UserService.updateProfile(user.id, { hasSeenOnboarding: true })
      setIsOpen(false)
    } catch (error) {
      logger.error('Error updating onboarding status', { error })
      // Even if it fails, close it for this session
      setIsOpen(false)
    } finally {
      setIsCompleting(false)
    }
  }

  const slide = ONBOARDING_SLIDES[currentSlide]
  const Icon = slide.icon
  const isLast = currentSlide === ONBOARDING_SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-space-800 border border-space-600 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-cyan-900/20 relative animate-in zoom-in-95 duration-300">
        
        {/* Skip button */}
        <button 
          onClick={handleComplete}
          disabled={isCompleting}
          className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
          aria-label="Saltar tour"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 pb-6 flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-2xl ${slide.bg} flex items-center justify-center mb-6 shadow-[0_0_30px_currentColor] ${slide.color} transition-all duration-500`}>
            <Icon className="w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">{slide.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed min-h-[80px]">
            {slide.description}
          </p>
        </div>

        {/* Indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {ONBOARDING_SLIDES.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-6 bg-cyan-400' : 'w-2 bg-space-600'}`}
            />
          ))}
        </div>

        {/* Footer / Controls */}
        <div className="p-4 bg-space-900/50 border-t border-space-600 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
            className={`text-muted-foreground hover:text-white ${currentSlide === 0 ? 'invisible' : ''}`}
            disabled={isCompleting}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Atrás
          </Button>

          {isLast ? (
            <Button 
              onClick={handleComplete} 
              disabled={isCompleting}
              className="bg-cyan-500 hover:bg-cyan-600 text-space-900 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              Comenzar
            </Button>
          ) : (
            <Button 
              onClick={() => setCurrentSlide(prev => Math.min(ONBOARDING_SLIDES.length - 1, prev + 1))}
              className="bg-space-700 hover:bg-space-600 text-white"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
