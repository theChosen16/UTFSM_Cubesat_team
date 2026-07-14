import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ProtectedRoute from './components/ProtectedRoute'
import { Spinner } from './components/ui/spinner'

// Heavy pages – loaded only when first visited
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const Members = lazy(() => import('./pages/Members'))
const Profile = lazy(() => import('./pages/Profile'))
const TaskManagement = lazy(() => import('./pages/TaskManagement'))
const Notifications = lazy(() => import('./pages/Notifications'))
const FileRepository = lazy(() => import('./pages/FileRepository'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Feed = lazy(() => import('./pages/Feed'))
const ProjectChat = lazy(() => import('./pages/ProjectChat'))

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-safe-screen min-h-screen bg-space-900" role="status" aria-label="Cargando aplicación">
        <Spinner className="min-safe-screen min-h-screen" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute user={user}>
            <Layout>
              <Suspense fallback={<Spinner className="min-h-[60vh]" />}>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:projectId/chat" element={<ProjectChat />} />
                  <Route path="/tasks" element={<TaskManagement />} />
                  <Route path="/files" element={<FileRepository />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:userId" element={<Profile />} />
                </Routes>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
