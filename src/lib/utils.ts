import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
