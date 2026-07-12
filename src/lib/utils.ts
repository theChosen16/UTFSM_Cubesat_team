import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Crown, Settings } from 'lucide-react'
import type { UserRole } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns the Lucide icon component for a given user role */
export function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'maestro': return Crown
    case 'admin': return Settings
  }
}

/**
 * Extracts a display name from an email address.
 * E.g. "alejandro.hernandeza@sansano.usm.cl" → "Alejandro"
 */
export function extractNameFromEmail(email: string | undefined | null): string {
  if (!email) return '?'
  const local = email.split('@')[0] || ''
  const name = local.split('.')[0] || ''
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

/**
 * Extracts nombre and apellido from an institutional email.
 * E.g. "alejandro.hernandeza@sansano.usm.cl" → { nombre: "Alejandro", apellido: "Hernandeza" }
 * E.g. "juan@usm.cl" → { nombre: "Juan", apellido: "" }
 */
export function extractFullNameFromEmail(email: string): { nombre: string; apellido: string } {
  const local = email.split('@')[0] || ''
  const parts = local.split('.')
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  const nombre = parts[0] ? capitalize(parts[0]) : ''
  const apellido = parts.length > 1 ? capitalize(parts[1]) : ''
  return { nombre, apellido }
}

/**
 * Protocolos permitidos al renderizar una URL controlada por el usuario en un `href`.
 * Excluye deliberadamente `javascript:`, `data:`, `vbscript:`, `file:`, etc.
 */
const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:']

/**
 * Sanea una URL de origen no confiable (perfiles, mensajes, metadatos de archivos) para
 * evitar XSS almacenado por `href`. React NO valida el esquema de un `href`, de modo que un
 * valor como `javascript:alert(document.cookie)` guardado en Firestore por cualquier miembro
 * se ejecutaría al hacer clic en otro navegador. Esta función devuelve la URL normalizada sólo
 * si usa un protocolo seguro (http/https/mailto); en caso contrario devuelve `undefined` para
 * que el llamador renderice texto plano en lugar de un enlace activo.
 *
 * - Recorta espacios y neutraliza caracteres de control que permiten contrabandear un esquema
 *   (p. ej. "java\tscript:" o "java\nscript:").
 * - A un valor sin esquema (p. ej. "linkedin.com/in/foo") se le antepone `https://`.
 */
export function sanitizeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined

  // Neutraliza espacios en blanco y caracteres de control (código <= 0x20 o 0x7F) que permiten
  // contrabandear un esquema peligroso, p. ej. "java\tscript:" o "\x01javascript:".
  const candidate = Array.from(url.trim())
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code > 0x20 && code !== 0x7f
    })
    .join('')
  if (!candidate) return undefined

  // Sin esquema explícito ni prefijo protocol-relative → asumir https (nunca javascript:).
  const withScheme = (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate) && !candidate.startsWith('//'))
    ? `https://${candidate}`
    : candidate

  try {
    const parsed = new URL(withScheme)
    return SAFE_URL_PROTOCOLS.includes(parsed.protocol) ? parsed.href : undefined
  } catch {
    return undefined
  }
}
