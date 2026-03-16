import { ReactNode, useState } from 'react'
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
  Crown,
  Shield,
  Bell,
  Lock
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn, extractNameFromEmail } from '@/lib/utils'
import { ROLE_LABELS, TEAM_LABELS, hasAnyRole, hasRole, hasTeam } from '@/types'
import { Badge } from '@/components/ui/badge'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, restricted: false },
    { path: '/projects', label: 'Proyectos', icon: FolderKanban, restricted: false },
    ...(hasAnyRole(user, 'maestro', 'admin') || hasTeam(user, 'manager') ? [
      { path: '/tasks', label: 'Gestión de Tareas', icon: ListTodo, restricted: true },
    ] : []),
    { path: '/members', label: 'Miembros', icon: Users, restricted: false },
    { path: '/notifications', label: 'Buzón', icon: Bell, restricted: false },
    { path: '/profile', label: 'Mi Perfil', icon: User, restricted: false },
  ]

  return (
    <div className="min-h-screen bg-space-900">
      {/* Skip to content — accessibility */}
      <a href="#main-content" className="skip-to-content">
        Saltar al contenido principal
      </a>

      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-lg bg-space-700/90 backdrop-blur-sm text-white hover:bg-space-600 transition-colors"
        aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={sidebarOpen}
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
          "fixed inset-y-0 left-0 z-40 w-64 bg-space-800/95 backdrop-blur-md border-r border-space-600/50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 will-change-transform",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-space-600">
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
          <div className="p-4 border-b border-space-600">
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
                  <div className="flex flex-col gap-1 mt-1">
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
          <nav className="flex-1 p-4 space-y-1" aria-label="Menú principal">
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
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative",
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
          </nav>

          {/* Sign out */}
          <div className="p-4 border-t border-space-600/50">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-muted-foreground hover:bg-red-500/15 hover:text-red-400 transition-all duration-200 group"
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main id="main-content" className="lg:ml-64 min-h-screen" role="main">
        <div className="p-4 lg:p-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
