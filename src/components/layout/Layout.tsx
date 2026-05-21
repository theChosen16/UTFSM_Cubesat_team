import { ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  User, 
  LogOut, 
  Menu, 
  X,
  Rocket,
  ListTodo,
  FolderOpen,
  Crown,
  Shield,
  Bell,
  Lock,
  Satellite,
  Calendar
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn, extractNameFromEmail } from '@/lib/utils'
import { hasRole } from '@/types'
import { ROLE_LABELS, TEAM_LABELS } from '@/lib/ui-constants'
import { Badge } from '@/components/ui/badge'
import { Chatbot } from '@/components/chat/Chatbot'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!sidebarOpen) return

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [sidebarOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, restricted: false },
    { path: '/projects', label: 'Proyectos', icon: FolderKanban, restricted: false },
    { path: '/tasks', label: 'Gestión de Tareas', icon: ListTodo, restricted: false },
    { path: '/calendar', label: 'Calendario', icon: Calendar, restricted: false },
    { path: '/files', label: 'Repertorio', icon: FolderOpen, restricted: false },
    { path: '/members', label: 'Miembros', icon: Users, restricted: false },
    { path: '/notifications', label: 'Buzón', icon: Bell, restricted: false },
    { path: '/profile', label: 'Mi Perfil', icon: User, restricted: false },
  ]

  return (
    <div className="min-safe-screen min-h-screen bg-space-900">
      {/* Skip to content — accessibility */}
      <a href="#main-content" className="skip-to-content">
        Saltar al contenido principal
      </a>

      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed left-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-space-600/70 bg-space-800/95 text-white shadow-lg shadow-black/30 backdrop-blur-sm transition-colors hover:bg-space-700 sm:left-4 sm:top-4"
        aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
        aria-controls="sidebar-nav"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        id="sidebar-nav"
        role="navigation"
        aria-label="Navegación principal"
        className={cn(
          "touch-scroll mobile-safe-top mobile-safe-bottom fixed inset-y-0 left-0 z-40 w-[min(18rem,calc(100vw-1.5rem))] border-r border-space-600/50 bg-space-800/95 shadow-2xl shadow-black/40 backdrop-blur-md transform transition-transform duration-300 ease-in-out will-change-transform sm:w-80 lg:w-72 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col pt-16 sm:pt-20 lg:pt-0">
          {/* Logo */}
          <div className="border-b border-space-600 px-4 py-5 sm:p-6">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USM Cubesat" className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">USM Cubesat</h1>
                <p className="text-xs text-muted-foreground">Team Portal</p>
              </div>
            </Link>
          </div>

          {/* User info */}
          <div className="border-b border-space-600 p-4">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={`${user.nombre} ${user.apellido}`}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }}
                />
              ) : null}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center ${user?.photoURL ? 'hidden' : ''}`}>
                  {hasRole(user, 'maestro') ? (
                    <Crown className="w-5 h-5 text-white" />
                  ) : hasRole(user, 'admin') ? (
                    <Shield className="w-5 h-5 text-white" />
                  ) : (
                    <Rocket className="w-5 h-5 text-white" />
                  )}
                </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.nombre || extractNameFromEmail(user?.email || '')} {user?.apellido || ''}
                </p>
                {user && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {user.rol && (
                      <Badge 
                        variant={user.rol === 'maestro' ? 'orange' : 'red'}
                        className="text-xs"
                      >
                        {ROLE_LABELS[user.rol]}
                      </Badge>
                    )}
                    {user.equipos?.map(team => (
                      <Badge 
                        key={team}
                        variant={
                          team === 'manager' ? 'cyan' :
                          team === 'tecnico' ? 'purple' : 'green'
                        }
                        className="text-xs"
                      >
                        {TEAM_LABELS[team]}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 pb-4 pt-3 sm:px-4" aria-label="Menú principal">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "group relative mb-1 flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-all duration-200 sm:px-4 sm:text-[15px]",
                    isActive
                      ? "bg-cyan-500/15 text-cyan-400 shadow-sm shadow-cyan-500/10"
                      : "text-muted-foreground hover:bg-space-700/80 hover:text-white"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan-400 rounded-r" />
                  )}
                  <Icon size={20} className={cn("transition-transform duration-200", !isActive && "group-hover:scale-110")} />
                  <span className="flex-1">{item.label}</span>
                  {item.restricted && (
                    <Lock size={14} className="text-orange-400 opacity-75" />
                  )}
                </Link>
              )
            })}

            <div className="my-4 border-t border-space-600/50" />
            <a
              href="https://ground-station-production-596d.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSidebarOpen(false)}
              className="group relative mb-1 flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-all duration-200 sm:px-4 sm:text-[15px] text-muted-foreground hover:bg-space-700/80 hover:text-white"
            >
              <Satellite size={20} className="transition-transform duration-200 group-hover:scale-110" />
              <span className="flex-1">Estación Terrena</span>
            </a>
          </nav>

          {/* Sign out */}
          <div className="border-t border-space-600/50 p-3 sm:p-4">
            <button
              onClick={handleSignOut}
              className="group flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-muted-foreground transition-all duration-200 hover:bg-red-500/15 hover:text-red-400"
            >
              <LogOut size={20} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/75 backdrop-blur-sm transition-opacity duration-200 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main id="main-content" className="min-safe-screen min-h-screen lg:ml-72" role="main">
        <div className="page-shell mobile-safe-bottom animate-fade-in px-4 pb-6 pt-20 sm:px-5 sm:pt-24 md:px-6 lg:px-8 lg:py-8 [contain:content]">
          {children}
        </div>
      </main>

      {/* AI Bot Component */}
      {user && <Chatbot />}
    </div>
  )
}
