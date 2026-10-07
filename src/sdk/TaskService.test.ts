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
import { TaskService } from './TaskService'

const snapshotOf = (data: Record<string, unknown>) => ({
  exists: () => true,
  id: 'task-1',
  data: () => data,
})

describe('TaskService — aprobación de entregables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no muestra como aprobado un entregable que el asignado marcó aprobado por su cuenta', async () => {
    vi.mocked(getDoc).mockResolvedValue(snapshotOf({
      titulo: 'Tarea',
      deliverables: [
        { id: 'd1', titulo: 'Informe', estado: 'aprobado' },
        { id: 'd2', titulo: 'Planos', estado: 'aprobado' },
      ],
      approvedDeliverableIds: ['d2'],
    }) as never)

    const task = await TaskService.getById('task-1')

    expect(task?.deliverables?.find(d => d.id === 'd1')?.estado).toBe('entregado')
    expect(task?.deliverables?.find(d => d.id === 'd2')?.estado).toBe('aprobado')
  })

  it('approveDeliverable registra la aprobación en el campo exclusivo de managers', async () => {
    vi.mocked(getDoc).mockResolvedValue(snapshotOf({
      titulo: 'Tarea',
      deliverables: [{ id: 'd1', titulo: 'Informe', estado: 'entregado' }],
    }) as never)

    await TaskService.approveDeliverable('task-1', 'd1', 'manager-uid')

    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      deliverables: [{ id: 'd1', titulo: 'Informe', estado: 'aprobado' }],
      approvedDeliverableIds: { __arrayUnion: ['d1'] },
    })
  })
})
