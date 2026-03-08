import { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'
import { Satellite, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Global error boundary that catches unhandled React errors, logs them via the
 * production logger, and presents a user-friendly recovery screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Unhandled React error caught by ErrorBoundary', {
      error,
      componentStack: errorInfo.componentStack ?? 'unavailable',
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-space-900 flex items-center justify-center p-4">
          <div className="max-w-md text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-xl bg-red-500/20">
                <Satellite className="w-12 h-12 text-red-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Algo salió mal</h1>
            <p className="text-muted-foreground">
              Ocurrió un error inesperado. El equipo ha sido notificado. Intenta recargar la página.
            </p>
            {this.state.error && (
              <pre className="text-left text-xs text-red-300 bg-space-800 p-3 rounded-lg overflow-auto max-h-32 border border-space-600">
                {this.state.error.message}
              </pre>
            )}
            <Button
              onClick={this.handleReload}
              className="bg-cyan-500 hover:bg-cyan-600 text-space-900"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Recargar página
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
