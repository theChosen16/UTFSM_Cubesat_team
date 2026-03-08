import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { logger } from './lib/logger.ts'
import './index.css'

// Capture unhandled errors and promise rejections globally
window.addEventListener('error', (event) => {
  logger.error('Unhandled global error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error instanceof Error ? event.error : undefined,
  })
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason instanceof Error ? event.reason : String(event.reason),
  })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename="/UTFSM_Cubesat_team">
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
