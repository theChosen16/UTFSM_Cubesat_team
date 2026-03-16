export function Spinner({ className = 'min-h-[400px]' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-label="Cargando">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-500/20 border-t-cyan-500" />
      <span className="sr-only">Cargando...</span>
    </div>
  )
}
