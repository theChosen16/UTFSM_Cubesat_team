import React, { createContext, useContext, useState, useRef, useEffect } from 'react'

interface DropdownMenuContextProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  triggerRef: React.RefObject<any>
}

const DropdownMenuContext = createContext<DropdownMenuContextProps | undefined>(undefined)

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<any>(null)

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

export function DropdownMenuTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const context = useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuTrigger must be used within a DropdownMenu')
  const { isOpen, setIsOpen, triggerRef } = context

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  if (asChild && React.isValidElement(children)) {
    const childProps = children.props as { onClick?: (e: React.MouseEvent) => void }
    return React.cloneElement(children as any, {
      ref: triggerRef,
      onClick: (e: React.MouseEvent) => {
        handleClick(e)
        if (childProps.onClick) {
          childProps.onClick(e)
        }
      }
    })
  }

  return (
    <button ref={triggerRef} onClick={handleClick}>
      {children}
    </button>
  )
}

export function DropdownMenuContent({
  children,
  align = 'end',
  className = '',
}: {
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  const context = useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuContent must be used within a DropdownMenu')
  const { isOpen, setIsOpen, triggerRef } = context
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, triggerRef, setIsOpen])

  if (!isOpen) return null

  const alignClass = align === 'end' ? 'right-0' : 'left-0'

  return (
    <div
      ref={menuRef}
      className={`absolute ${alignClass} mt-2 w-48 rounded-md shadow-lg bg-space-800 border border-space-600 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 ${className}`}
    >
      <div className="py-1">{children}</div>
    </div>
  )
}

export function DropdownMenuItem({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const context = useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuItem must be used within a DropdownMenu')
  const { setIsOpen } = context

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
    if (onClick) onClick()
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-space-700 hover:text-white flex items-center transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
