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
import { ROLE_LABELS, TEAM_LABELS } from '@/types'
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
    ...(user?.rol === 'maestro' || user?.rol === 'admin' || user?.equipo === 'manager' ? [
      { path: '/tasks', label: 'Gestión de Tareas', icon: ListTodo, restricted: true },
    ] : []),
    { path: '/members', label: 'Miembros', icon: Users, restricted: false },
    { path: '/notifications', label: 'Buzón', icon: Bell, restricted: false },
    { path: '/profile', label: 'Mi Perfil', icon: User, restricted: false },
  ]

  return (
    <div className="min-h-screen bg-space-900">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-space-700 text-white"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-space-800 border-r border-space-600 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
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
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                  {user?.rol === 'maestro' ? (
                    <Crown className="w-5 h-5 text-white" />
                  ) : user?.rol === 'admin' ? (
                    <Shield className="w-5 h-5 text-white" />
                  ) : (
                    <Rocket className="w-5 h-5 text-white" />
                  )}
                </div>
              )}
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
                    {user.equipo && (
                      <Badge 
                        variant={
                          user.equipo === 'manager' ? 'cyan' :
                          user.equipo === 'tecnico' ? 'purple' : 'green'
                        }
                        className="text-xs"
                      >
                        {TEAM_LABELS[user.equipo]}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-muted-foreground hover:bg-space-700 hover:text-white"
                  )}
                >
                  <Icon size={20} />
                  <span className="flex-1">{item.label}</span>
                  {item.restricted && (
                    <Lock size={14} className="text-orange-400" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Sign out */}
          <div className="p-4 border-t border-space-600">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-muted-foreground hover:bg-red-500/20 hover:text-red-400 transition-colors"
            >
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
