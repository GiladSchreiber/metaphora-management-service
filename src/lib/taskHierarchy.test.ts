import { describe, expect, it } from 'vitest'
import { buildSeed } from '../data/seed'
import { assertTaskParent, descendantIds, parentCandidates, taskForest } from './taskHierarchy'
import type { Task } from '../types'

function task(id: string, parentTaskId: string | null = null, status: Task['status'] = 'open'): Task {
  return { ...buildSeed([]).tasks[0], id, parentTaskId, status }
}

describe('task attachments', () => {
  const tasks = [task('parent'), task('child', 'parent'), task('grandchild', 'child'), task('other')]

  it('excludes the task itself and all descendants from possible parents', () => {
    expect(parentCandidates(tasks, 'parent').map(item => item.id)).toEqual(['other'])
    expect(parentCandidates(tasks, 'child').map(item => item.id)).toEqual(['parent', 'other'])
    expect([...descendantIds(tasks, 'parent')]).toEqual(['child', 'grandchild'])
  })

  it('rejects direct and indirect cycles, and missing parents', () => {
    expect(() => assertTaskParent(tasks, 'parent', 'parent')).toThrow()
    expect(() => assertTaskParent(tasks, 'parent', 'grandchild')).toThrow()
    expect(() => assertTaskParent(tasks, 'parent', 'missing')).toThrow()
    expect(() => assertTaskParent(tasks, 'grandchild', 'other')).not.toThrow()
    expect(() => assertTaskParent(tasks, 'child', null)).not.toThrow()
  })

  it('renders each nested task under its parent without duplicate roots', () => {
    const { roots, activeRootIds } = taskForest(tasks)
    expect(roots.map(item => item.id)).toEqual(['parent', 'other'])
    expect([...activeRootIds]).toEqual(['parent', 'other'])
  })

  it('keeps matching children discoverable when their parents are filtered out', () => {
    const filtered = tasks.filter(item => item.id !== 'parent')
    expect(taskForest(filtered).roots.map(item => item.id)).toEqual(['child', 'other'])
  })

  it('keeps completed parents visible with unfinished descendants', () => {
    const nested = [task('parent', null, 'done'), task('child', 'parent', 'done'), task('grandchild', 'child')]
    expect([...taskForest(nested).activeRootIds]).toEqual(['parent'])
    nested[2].status = 'done'
    expect([...taskForest(nested).activeRootIds]).toEqual([])
  })
})
