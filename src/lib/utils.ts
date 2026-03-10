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
