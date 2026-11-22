import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSeed } from '../data/seed'

const repo = vi.hoisted(() => ({
  load: vi.fn(), saveTask: vi.fn(), setTaskStatus: vi.fn(), setSubtaskDone: vi.fn(),
}))
vi.mock('../repositories', () => ({ repo }))
import { useAppStore } from './appStore'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture() {
  const data = buildSeed([])
  data.tasks = [{ ...data.tasks[0], subtasks: [
    { id: 'a', title: 'First', done: false },
    { id: 'b', title: 'Second', done: false },
  ] }]
  return data
}
const task = () => useAppStore.getState().data.tasks[0]

beforeEach(() => {
  vi.resetAllMocks()
  useAppStore.setState({ data: fixture(), loaded: true, loading: false, error: '' })
})

describe('optimistic task checkboxes', () => {
  it('updates immediately and does not reload app data after saving', async () => {
    const save = deferred()
    repo.setTaskStatus.mockReturnValueOnce(save.promise)
    const pending = useAppStore.getState().setTaskStatus(task().id, 'done')
    expect(task().status).toBe('done')
    expect(task().doneAt).toBeTruthy()
    save.resolve()
    await pending
    expect(repo.load).not.toHaveBeenCalled()
  })

  it('rolls back a failed save and reports it without rejecting the UI handler', async () => {
    repo.setTaskStatus.mockRejectedValueOnce(new Error('offline'))
    await useAppStore.getState().setTaskStatus(task().id, 'done')
    expect(task().status).toBe('open')
    expect(task().doneAt).toBeNull()
    expect(useAppStore.getState().error).toContain('offline')
  })

  it('serializes rapid clicks and keeps the latest choice visible', async () => {
    const first = deferred()
    const second = deferred()
    repo.setTaskStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const id = task().id
    const done = useAppStore.getState().setTaskStatus(id, 'done')
    const open = useAppStore.getState().setTaskStatus(id, 'open')
    expect(task().status).toBe('open')
    await Promise.resolve()
    expect(repo.setTaskStatus).toHaveBeenCalledTimes(1)
    first.resolve()
    await done
    expect(task().status).toBe('open')
    second.resolve()
    await open
    expect(repo.setTaskStatus.mock.calls.map(call => call[1])).toEqual(['done', 'open'])
  })

  it('rolls back to the last confirmed value when a later click fails', async () => {
    const first = deferred()
    repo.setTaskStatus.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error('offline'))
    const id = task().id
    const done = useAppStore.getState().setTaskStatus(id, 'done')
    const open = useAppStore.getState().setTaskStatus(id, 'open')
    first.resolve()
    await Promise.all([done, open])
    expect(task().status).toBe('done')
    expect(task().doneAt).toBeTruthy()
  })

  it('rolls back only the failed subtask, preserving other checkbox changes', async () => {
    const first = deferred()
    repo.setSubtaskDone.mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined)
    const id = task().id
    const a = useAppStore.getState().setSubtaskDone(id, 'a', true)
    const b = useAppStore.getState().setSubtaskDone(id, 'b', true)
    expect(task().subtasks.every(item => item.done)).toBe(true)
    first.reject(new Error('offline'))
    await Promise.all([a, b])
    expect(task().subtasks.map(item => item.done)).toEqual([false, true])
    expect(task().status).toBe('open')
  })

  it('keeps pending changes visible during unrelated refreshes', async () => {
    const save = deferred()
    repo.setSubtaskDone.mockReturnValueOnce(save.promise)
    const pending = useAppStore.getState().setSubtaskDone(task().id, 'a', true)
    repo.load.mockResolvedValueOnce(fixture())
    await useAppStore.getState().refresh()
    expect(task().subtasks[0].done).toBe(true)
    save.resolve()
    await pending
  })

  it('discards stale refresh responses that began before a checkbox save settled', async () => {
    let resolveLoad!: (data: ReturnType<typeof fixture>) => void
    repo.load.mockReturnValueOnce(new Promise(resolve => { resolveLoad = resolve }))
    const refresh = useAppStore.getState().refresh()
    repo.setTaskStatus.mockResolvedValueOnce(undefined)
    await useAppStore.getState().setTaskStatus(task().id, 'done')
    const fresh = fixture()
    fresh.tasks[0] = { ...task() }
    repo.load.mockResolvedValueOnce(fresh)
    resolveLoad(fixture())
    await refresh
    expect(task().status).toBe('done')
    expect(repo.load).toHaveBeenCalledTimes(2)
  })
})

it('waits for pending checkboxes before saving an edited task', async () => {
  const save = deferred()
  repo.setTaskStatus.mockReturnValueOnce(save.promise)
  repo.saveTask.mockResolvedValueOnce(undefined)
  repo.load.mockResolvedValueOnce(fixture())
  const toggle = useAppStore.getState().setTaskStatus(task().id, 'done')
  const edit = useAppStore.getState().saveTask({ ...task(), topic: 'Edited' })
  expect(repo.saveTask).not.toHaveBeenCalled()
  save.reject(new Error('offline'))
  await Promise.all([toggle, edit])
  expect(repo.saveTask).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Edited', status: 'open' }))
})
