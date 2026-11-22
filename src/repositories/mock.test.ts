import { beforeEach, expect, it, vi } from 'vitest'
import { buildSeed } from '../data/seed'
import { MockRepository } from './mock'

let saved: string | null
beforeEach(() => {
  saved = null
  vi.stubGlobal('localStorage', {
    getItem: () => saved,
    setItem: (_key: string, value: string) => { saved = value },
  })
})

it('loads older stored tasks with empty checklists without losing their data', async () => {
  const old = buildSeed([])
  saved = JSON.stringify(old, (key, value) => key === 'subtasks' ? undefined : value)
  const data = await new MockRepository().load()
  expect(data.tasks[0].subtasks).toEqual([])
  expect(data.tasks[0].topic).toBe(old.tasks[0].topic)
})

it('persists added, edited, checked and removed subtasks across reloads', async () => {
  const repo = new MockRepository()
  const original = (await repo.load()).tasks[0]
  await repo.saveTask({ ...original, subtasks: [
    { id: 'a', title: ' First ', done: false },
    { id: 'b', title: 'Second', done: false },
  ] })
  await repo.setSubtaskDone(original.id, 'a', true)
  let task = (await repo.load()).tasks.find(item => item.id === original.id)!
  expect(task.subtasks[0]).toEqual({ id: 'a', title: 'First', done: true })
  await repo.saveTask({ ...task, subtasks: [{ ...task.subtasks[0], title: 'Renamed' }] })
  task = (await new MockRepository().load()).tasks.find(item => item.id === original.id)!
  expect(task.subtasks).toEqual([{ id: 'a', title: 'Renamed', done: true }])
  expect(task.status).toBe('open')
})
