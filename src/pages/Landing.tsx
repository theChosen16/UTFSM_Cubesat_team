import { Link } from 'react-router-dom'
import { Rocket, Cpu, Users, Globe, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Landing() {
  return (
    <div className="min-h-screen bg-space-900 relative overflow-hidden">
      {/* Stars background with depth effect */}
      <div className="absolute inset-0 stars-depth">
        <div className="absolute inset-0 stars-bg opacity-80" />
      </div>
      
      {/* Focal glow — wandering point of light */}
      <div className="absolute inset-0 focal-glow pointer-events-none" />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-space-900/50 to-space-900" />

      {/* Hero Section */}
      <header className="relative z-10">
        <nav className="container mx-auto px-6 py-6">
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
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USM Cubesat" className="relative w-28 h-28 drop-shadow-[0_0_25px_rgba(6,182,212,0.4)]" />
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
      <section className="relative z-10 py-20 bg-space-800/50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
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

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-space-700">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USM Cubesat" className="w-8 h-8" />
              <span className="text-muted-foreground">USM Cubesat Team © {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://github.com/theChosen16/UTFSM_Cubesat_team" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-cyan-400 transition-colors">
                GitHub
              </a>
              <a href="https://www.instagram.com/usm.cubesat.team/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-cyan-400 transition-colors">
                Instagram
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
