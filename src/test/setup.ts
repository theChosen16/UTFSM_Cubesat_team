import '@testing-library/jest-dom'

// Polyfill IntersectionObserver for jsdom (not available in jsdom environment)
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root: Element | null = null
    readonly rootMargin: string = '0px'
    readonly thresholds: readonly number[] = [0]

    constructor(
      _callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {}

    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return [] }
  } as unknown as typeof IntersectionObserver
}
