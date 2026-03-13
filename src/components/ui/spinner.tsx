export function Spinner({ className = 'min-h-[400px]' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
    </div>
  )
}
