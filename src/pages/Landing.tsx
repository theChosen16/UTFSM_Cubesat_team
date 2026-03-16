import { Link } from 'react-router-dom'
import { Rocket, Cpu, Users, Globe, ArrowRight, Award, Flame, Building2, Trophy, Flag, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useRef } from 'react'

const TIMELINE_EVENTS = [
  {
    year: '2019',
    title: 'Fundación del Equipo',
    description: 'Nuestro equipo fue fundado bajo la dirección del Dr. Rodrigo Cassinelli, académico del Departamento de Ingeniería Mecánica de la USM. Desde el inicio, conformamos un grupo multidisciplinario integrando estudiantes de Ingeniería Civil Mecánica, Informática, Telemática y Física, con el objetivo de canalizar talento técnico hacia la Nueva Economía Espacial.',
    icon: Flag,
    color: 'cyan',
  },
  {
    year: '2020',
    title: '5° Lugar en CubeDesign — Brasil',
    description: 'En nuestra primera participación internacional, alcanzamos el quinto lugar en el concurso CubeDesign organizado por el INPE de Brasil. A pesar de competir en modalidad virtual debido a la pandemia, validamos nuestros cálculos teóricos y algoritmos de control frente a equipos con mayor trayectoria.',
    icon: Rocket,
    color: 'purple',
  },
  {
    year: '2022',
    title: '3° Lugar en CubeDesign — Brasil',
    description: 'Consolidamos nuestra presencia en el podio internacional con un tercer lugar. Perfeccionamos nuestros modelos CAD y simulaciones en MATLAB/Simulink, dominando la simulación de condiciones orbitales extremas como radiación solar, estrés térmico y dinámica de fluidos.',
    icon: Trophy,
    color: 'orange',
  },
  {
    year: '2024',
    title: 'Medalla de Oro — CubeDesign 2023',
    description: 'Logramos el primer lugar general y la medalla de oro en la primera edición presencial post-pandemia en las instalaciones del INPE. Nuestro nanosatélite superó pruebas de certificación de grado espacial: apuntamiento solar autónomo, resistencia a vibración extrema, estabilización giroscópica y detección de rayos. Nos convertimos en el primer equipo universitario chileno en ganar el certamen.',
    icon: Award,
    color: 'yellow',
  },
  {
    year: '2024',
    title: 'Expositores en el IAC 2024 — Milán',
    description: 'Fuimos seleccionados por la AIDAA para participar en el 75° Congreso Internacional de Astronáutica, el foro global más importante del sector espacial. Presentamos una adaptación de nuestro nanosatélite enfocada en la detección temprana de incendios forestales, siendo uno de los únicos cinco grupos estudiantiles de fuera de la Unión Europea admitidos.',
    icon: Sparkles,
    color: 'cyan',
  },
  {
    year: '2025',
    title: 'Centro Espacial Nacional',
    description: 'Fuimos invitados a representar a la USM en la inauguración del Centro Espacial Nacional, donde presentamos nuestro nanosatélite al presidente Gabriel Boric. En CubeDesign 2025, competimos con un CubeSat de 3U y obtuvimos el reconocimiento al mejor sistema eléctrico de potencia (EPS).',
    icon: Building2,
    color: 'green',
  },
  {
    year: '2026',
    title: 'USM CubeSat Design Competition',
    description: 'Transitamos hacia un rol formativo y organizador, preparándonos para albergar competencias de diseño de satélites en nuestra propia universidad. Simultáneamente, avanzamos en la búsqueda de financiamiento para la inserción orbital real de nuestro hardware, demostrando que la ingeniería de precisión y la manufactura local pueden competir al más alto nivel.',
    icon: Flame,
    color: 'purple',
  },
] as const

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const items = container.querySelectorAll('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )

    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])

  return ref
}

export default function Landing() {
  const timelineRef = useScrollReveal()

  return (
    <div className="min-h-screen bg-space-900 relative overflow-hidden">
      {/* Stars background with depth effect */}
      <div className="absolute inset-0 stars-depth">
        <div className="absolute inset-0 stars-bg opacity-80" />
        <div className="absolute inset-0 stars-fractal-a" />
        <div className="absolute inset-0 stars-fractal-b" />
      </div>
      
      {/* Focal glow — wandering point of light */}
      <div className="absolute inset-0 focal-glow pointer-events-none" />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-space-900/50 to-space-900" />

      {/* Hero Section */}
      <header className="relative z-10" role="banner">
        <nav className="container mx-auto px-6 py-6" aria-label="Navegación principal">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-500/20">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USM Cubesat" className="w-10 h-10" />
              </div>
              <span className="text-xl font-bold text-white">USM Cubesat Team</span>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" className="text-white hover:text-cyan-400">
                  Iniciar Sesión
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-space-900">
                  Unirse al Equipo
                </Button>
              </Link>
            </div>
            <div className="flex sm:hidden items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-white hover:text-cyan-400 px-2">
                  Entrar
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-space-900 px-2">
                  Unirse
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="container mx-auto px-6 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USM Cubesat" className="relative w-28 h-28 drop-shadow-[0_0_25px_rgba(6,182,212,0.4)]" loading="eager" fetchPriority="high" />
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-space-700 border border-space-600 mb-8">
              <Rocket className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-muted-foreground">Universidad Técnica Federico Santa María</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Construyendo el futuro del{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                espacio
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Somos un equipo universitario dedicado al diseño, construcción y operación de nano satélites. 
              Únete a nosotros y forma parte de la próxima generación de exploradores espaciales.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-space-900 font-semibold px-8">
                  Comenzar Ahora
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-space-600 text-white hover:bg-space-700">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="relative z-10 py-20 bg-space-800/50" aria-labelledby="teams-heading">
        <div className="container mx-auto px-6">
          <h2 id="teams-heading" className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
            Nuestros Equipos
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Technical Team */}
            <div className="p-6 rounded-2xl bg-space-700/50 border border-space-600 hover:border-purple-500/50 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Cpu className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Equipo Técnico</h3>
              <p className="text-muted-foreground">
                Software, hardware, estructura, simulación y cálculos teóricos para el dimensionamiento del sistema.
              </p>
            </div>

            {/* Manager Team */}
            <div className="p-6 rounded-2xl bg-space-700/50 border border-space-600 hover:border-cyan-500/50 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Manager</h3>
              <p className="text-muted-foreground">
                Generación de proyectos, control del equipo y guía para el desarrollo exitoso de cada misión.
              </p>
            </div>

            {/* PR Team */}
            <div className="p-6 rounded-2xl bg-space-700/50 border border-space-600 hover:border-green-500/50 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Relaciones Públicas</h3>
              <p className="text-muted-foreground">
                Redes sociales, FabLab, contactos universitarios y gestión de recursos y trámites.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* History Timeline */}
      <section className="relative z-10 py-20 bg-space-900/80" aria-labelledby="timeline-heading">
        <div className="container mx-auto px-6">
          <h2 id="timeline-heading" className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Nuestra Trayectoria
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Desde nuestra fundación en 2019, hemos forjado un camino de excelencia en ingeniería aeroespacial estudiantil.
          </p>

          <div ref={timelineRef} className="relative max-w-4xl mx-auto">
            {/* Timeline center line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/60 via-purple-500/60 to-cyan-500/60 md:-translate-x-px" />

            {TIMELINE_EVENTS.map((event, index) => {
              const isLeft = index % 2 === 0
              const EventIcon = event.icon
              const colorMap = {
                cyan: { dot: 'bg-cyan-500', glow: 'shadow-cyan-500/50', text: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
                purple: { dot: 'bg-purple-500', glow: 'shadow-purple-500/50', text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
                orange: { dot: 'bg-orange-500', glow: 'shadow-orange-500/50', text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
                yellow: { dot: 'bg-yellow-500', glow: 'shadow-yellow-500/50', text: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
                green: { dot: 'bg-green-500', glow: 'shadow-green-500/50', text: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10' },
              }
              const colors = colorMap[event.color]

              return (
                <div
                  key={`${event.year}-${index}`}
                  data-reveal
                  className={`timeline-item relative flex items-start mb-12 last:mb-0 ${
                    isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Dot on timeline */}
                  <div className="absolute left-4 md:left-1/2 -translate-x-1/2 z-10">
                    <div className={`w-10 h-10 rounded-full ${colors.dot} ${colors.glow} shadow-lg flex items-center justify-center`}>
                      <EventIcon className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  {/* Card */}
                  <div className={`ml-14 md:ml-0 md:w-[calc(50%-2rem)] ${isLeft ? 'md:pr-8 md:text-right' : 'md:pl-8 md:ml-auto'}`}>
                    <div className={`p-5 rounded-xl bg-space-700/60 border ${colors.border} backdrop-blur-sm hover:bg-space-700/80 transition-colors`}>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${colors.bg} mb-3`}>
                        <span className={`text-sm font-bold ${colors.text}`}>{event.year}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{event.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-space-700" role="contentinfo">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-8 h-8" aria-hidden="true" loading="lazy" />
              <span className="text-muted-foreground">USM Cubesat Team © {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://github.com/theChosen16/UTFSM_Cubesat_team" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-cyan-400 transition-colors" aria-label="Repositorio en GitHub">
                GitHub
              </a>
              <a href="https://www.instagram.com/usm.cubesat.team/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-cyan-400 transition-colors" aria-label="Perfil de Instagram">
                Instagram
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
