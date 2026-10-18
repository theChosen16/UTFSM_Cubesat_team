import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDocMock = vi.fn()
const updateDocMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  doc: vi.fn(() => ({})),
  addDoc: vi.fn(),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  Timestamp: { now: vi.fn() },
  arrayUnion: vi.fn(),
  deleteField: vi.fn(),
}))

vi.mock('@/lib/firebase', () => ({ db: {} }))

vi.mock('./ActivityLogService', () => ({
  ActivityLogService: { create: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('./NotificationService', () => ({
  NotificationService: {},
}))

import { DELIVERABLE_CHANGED_ERROR, TaskService } from './TaskService'

const mockTask = (attachmentIds: string[]) => {
  getDocMock.mockResolvedValue({
    id: 't1',
    exists: () => true,
    data: () => ({
      titulo: 'Tarea',
      deliverables: [{ id: 'd1', titulo: 'Informe', estado: 'entregado', attachmentIds }],
    }),
  })
}

describe('TaskService.updateDeliverable — aprobación', () => {
  beforeEach(() => {
    getDocMock.mockReset()
    updateDocMock.mockReset()
  })

  it('records the approval for the files the manager reviewed', async () => {
    mockTask(['f2', 'f1'])
    await TaskService.updateDeliverable('t1', 'd1', { estado: 'aprobado' }, 'mgr', 'f1,f2')
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deliverableApprovals: { d1: 'f1,f2' } })
    )
  })

  it('refuses to approve files that changed after the review was loaded', async () => {
    mockTask(['f1', 'f3'])
    await expect(
      TaskService.updateDeliverable('t1', 'd1', { estado: 'aprobado' }, 'mgr', 'f1')
    ).rejects.toThrow(DELIVERABLE_CHANGED_ERROR)
    await expect(
      TaskService.updateDeliverable('t1', 'd1', { estado: 'aprobado' }, 'mgr')
    ).rejects.toThrow(DELIVERABLE_CHANGED_ERROR)
    expect(updateDocMock).not.toHaveBeenCalled()
  })
})
