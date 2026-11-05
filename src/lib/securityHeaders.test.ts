import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

/**
 * `public/_headers` (Cloudflare Pages) autoriza los scripts inline de index.html por su hash
 * SHA-256 en lugar de 'unsafe-inline'. Si alguien edita un script inline sin actualizar su hash,
 * el navegador lo bloquearía en producción (el framebuster o la redirección SPA dejarían de
 * correr en silencio). Este test hace que esa desincronización falle en CI.
 */
const root = resolve(__dirname, '..', '..')
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8')
const headersFile = readFileSync(resolve(root, 'public', '_headers'), 'utf8')

const headerValue = (name: string): string | undefined => {
  const line = headersFile
    .split('\n')
    .find(entry => entry.trimStart().toLowerCase().startsWith(`${name.toLowerCase()}:`))
  return line?.slice(line.indexOf(':') + 1).trim()
}

const inlineScriptHashes = (): string[] =>
  [...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(match =>
    `'sha256-${createHash('sha256').update(match[1].replace(/\r\n/g, '\n'), 'utf8').digest('base64')}'`
  )

const directive = (csp: string, name: string): string[] => {
  const found = csp.split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `))
  return found ? found.split(/\s+/).slice(1) : []
}

describe('public/_headers', () => {
  const csp = headerValue('Content-Security-Policy') ?? ''

  it('envía una CSP por cabecera', () => {
    expect(csp).not.toBe('')
  })

  it('autoriza cada script inline de index.html por su hash exacto', () => {
    const hashes = inlineScriptHashes()
    expect(hashes.length).toBeGreaterThan(0)
    const scriptSrc = directive(csp, 'script-src')
    for (const hash of hashes) {
      expect(scriptSrc).toContain(hash)
    }
  })

  it('no permite scripts inline arbitrarios ni eval', () => {
    const scriptSrc = directive(csp, 'script-src')
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
  })

  it('bloquea el embebido en iframes (clickjacking)', () => {
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"])
    expect(headerValue('X-Frame-Options')).toBe('DENY')
  })

  it('mantiene las restricciones de la CSP <meta>', () => {
    expect(directive(csp, 'object-src')).toEqual(["'none'"])
    expect(directive(csp, 'base-uri')).toEqual(["'self'"])
    expect(directive(csp, 'img-src')).toEqual(["'self'", 'data:'])
  })

  it('incluye las cabeceras que no funcionan desde <meta>', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff')
    expect(headerValue('Strict-Transport-Security')).toMatch(/max-age=\d{7,}/)
    expect(headerValue('Cross-Origin-Opener-Policy')).toBe('same-origin')
  })
})
