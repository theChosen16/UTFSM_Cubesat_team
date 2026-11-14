/**
 * Utilidades compartidas para interpolar texto NO confiable (documentos de Firestore escritos por
 * miembros) dentro de prompts del asistente: tanto en la instrucción de sistema (BotService) como
 * en las respuestas de herramientas que vuelven al modelo (AdminActionsService).
 */

/** Largo máximo por defecto de un campo interpolado. */
export const CONTEXT_FIELD_MAX_CHARS = 120

/**
 * Neutraliza un valor almacenado en Firestore antes de interpolarlo en la instrucción de sistema.
 *
 * El contexto vivo (nombres y descripciones de proyectos, títulos de tareas) es texto que
 * cualquier miembro del equipo `manager` —y el propio bot, vía `auditarActaDrive`— puede
 * escribir, y termina dentro del `systemInstruction`, que es la parte del prompt que el modelo
 * trata como voz del operador. Un título de tarea con instrucciones embebidas es por tanto una
 * inyección de prompt ALMACENADA: no depende de un adjunto, sobrevive a `resetSession()` y se
 * aplica a la sesión de cualquier administrador que abra el chat después.
 *
 * Se elimina lo que permite hacerse pasar por estructura del prompt en vez de por dato:
 * - saltos de línea y caracteres de control (un valor no puede abrir un "bloque" propio),
 * - '<' y '>' (los delimitadores del bloque de datos no confiables),
 * - '[' y ']' (la forma de las cabeceras reales del prompt, p. ej. "[MODO ADMINISTRADOR ACTIVO]").
 * Además se recorta cada campo, para que un solo documento no pueda desplazar al resto del
 * prompt por volumen.
 */
export function neutralizeContextValue(value: unknown, maxChars: number = CONTEXT_FIELD_MAX_CHARS): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''

  const flattened = Array.from(String(value))
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code < 0x20 || code === 0x7f) return ' '
      if (ch === '<' || ch === '>' || ch === '[' || ch === ']') return ' '
      return ch
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  if (flattened.length <= maxChars) return flattened
  return `${flattened.slice(0, maxChars).trimEnd()}…`
}
