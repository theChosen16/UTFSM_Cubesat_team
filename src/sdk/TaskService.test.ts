import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  Timestamp: { now: vi.fn(() => new Date()) },
  arrayUnion: vi.fn((...values: unknown[]) => ({ __arrayUnion: values })),
  deleteField: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('./ActivityLogService', () => ({
  ActivityLogService: { create: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('./NotificationService', () => ({
  NotificationService: { notifyDeliverableUploaded: vi.fn().mockResolvedValue(undefined) },
}))

import { getDoc, updateDoc } from 'firebase/firestore'
import { TaskService, deliverableFingerprint } from './TaskService'
import type { TaskDeliverable } from '@/types'

const snapshotOf = (data: Record<string, unknown>) => ({
  exists: () => true,
  id: 'task-1',
  data: () => data,
})

const delivered: TaskDeliverable = {
  id: 'd1',
  titulo: 'Informe',
  estado: 'entregado',
  attachmentIds: ['file-a'],
  deliveredAt: '2026-10-01T00:00:00.000Z',
  deliveredBy: 'member-uid',
}

const loadTask = async (data: Record<string, unknown>) => {
  vi.mocked(getDoc).mockResolvedValue(snapshotOf({ titulo: 'Tarea', ...data }) as never)
  return TaskService.getById('task-1')
}

describe('TaskService — aprobación de entregables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no muestra como aprobado un entregable que el asignado marcó aprobado por su cuenta', async () => {
    const task = await loadTask({ deliverables: [{ ...delivered, estado: 'aprobado' }] })
    expect(task?.deliverables?.[0].estado).toBe('entregado')
  })

  it('muestra como aprobado el entregable cuyo contenido coincide con la huella del manager', async () => {
    const task = await loadTask({
      deliverables: [delivered],
      approvedDeliverables: { d1: deliverableFingerprint(delivered) },
    })
    expect(task?.deliverables?.[0].estado).toBe('aprobado')
  })

  it('invalida la aprobación si el asignado cambia los adjuntos de un entregable aprobado', async () => {
    const task = await loadTask({
      deliverables: [{ ...delivered, estado: 'aprobado', attachmentIds: ['file-malicioso'] }],
      approvedDeliverables: { d1: deliverableFingerprint(delivered) },
    })
    expect(task?.deliverables?.[0].estado).toBe('entregado')
  })

  it('no hereda la aprobación un entregable que reutiliza el id de otro aprobado', async () => {
    const task = await loadTask({
      deliverables: [delivered, { ...delivered, estado: 'aprobado' }],
      approvedDeliverables: { d1: deliverableFingerprint(delivered) },
    })
    expect(task?.deliverables?.map(d => d.estado)).toEqual(['aprobado', 'entregado'])
  })

  it('approveDeliverable registra la huella en el campo exclusivo de managers', async () => {
    vi.mocked(getDoc).mockResolvedValue(snapshotOf({ titulo: 'Tarea', deliverables: [delivered] }) as never)

    await TaskService.approveDeliverable('task-1', 'd1', 'manager-uid')

    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      deliverables: [{ ...delivered, estado: 'aprobado' }],
      approvedDeliverables: { d1: deliverableFingerprint(delivered) },
    })
  })
})
