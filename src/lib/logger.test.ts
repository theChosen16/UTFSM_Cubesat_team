import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, LogEntry } from '@/lib/logger'

describe('Logger', () => {
  beforeEach(() => {
    logger.clear()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores info entries', () => {
    logger.info('test message')
    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('info')
    expect(entries[0].message).toBe('test message')
    expect(entries[0].timestamp).toBeTruthy()
  })

  it('stores warn entries', () => {
    logger.warn('warning message')
    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('warn')
  })

  it('stores error entries', () => {
    logger.error('error message')
    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('error')
  })

  it('stores context with entries', () => {
    logger.info('with context', { userId: '123', action: 'login' })
    const entries = logger.getEntries()
    expect(entries[0].context).toEqual({ userId: '123', action: 'login' })
  })

  it('serializes Error objects in context', () => {
    const err = new Error('something broke')
    logger.error('caught error', { error: err })
    const entries = logger.getEntries()
    const ctx = entries[0].context as Record<string, unknown>
    const errorCtx = ctx.error as Record<string, unknown>
    expect(errorCtx.message).toBe('something broke')
    expect(errorCtx.name).toBe('Error')
  })

  it('getErrors returns only error-level entries', () => {
    logger.info('info')
    logger.warn('warn')
    logger.error('error 1')
    logger.error('error 2')
    expect(logger.getErrors()).toHaveLength(2)
  })

  it('clear removes all entries', () => {
    logger.info('one')
    logger.error('two')
    logger.clear()
    expect(logger.getEntries()).toHaveLength(0)
  })

  it('exportJSON returns valid JSON', () => {
    logger.info('test')
    const json = logger.exportJSON()
    const parsed = JSON.parse(json) as LogEntry[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0].message).toBe('test')
  })

  it('mirrors log to console', () => {
    logger.info('info msg')
    logger.warn('warn msg')
    logger.error('error msg')
    expect(console.info).toHaveBeenCalledWith('[CubeSat] info msg', expect.anything())
    expect(console.warn).toHaveBeenCalledWith('[CubeSat] warn msg', expect.anything())
    expect(console.error).toHaveBeenCalledWith('[CubeSat] error msg', expect.anything())
  })

  it('respects max entry limit', () => {
    for (let i = 0; i < 250; i++) {
      logger.info(`entry ${i}`)
    }
    expect(logger.getEntries().length).toBeLessThanOrEqual(200)
  })
})
