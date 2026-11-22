import type { Task } from '../types'

type TaskLink = Pick<Task, 'id' | 'parentTaskId'>

export function descendantIds(tasks: TaskLink[], taskId: string): Set<string> {
  const descendants = new Set<string>()
  const queue = [taskId]
  for (let index = 0; index < queue.length; index++) {
    for (const task of tasks) {
      if (task.parentTaskId !== queue[index] || descendants.has(task.id)) continue
      descendants.add(task.id)
      queue.push(task.id)
    }
  }
  return descendants
}

export function parentCandidates<T extends TaskLink>(tasks: T[], taskId?: string): T[] {
  const excluded = taskId ? descendantIds(tasks, taskId) : new Set<string>()
  return tasks.filter(task => task.id !== taskId && !excluded.has(task.id))
}

export function assertTaskParent(tasks: TaskLink[], taskId: string, parentTaskId: string | null): void {
  if (parentTaskId === null) return
  if (!tasks.some(task => task.id === parentTaskId)) throw new Error('משימת האב לא נמצאה')
  if (parentTaskId === taskId || descendantIds(tasks, taskId).has(parentTaskId)) {
    throw new Error('אי אפשר לשייך משימה לעצמה או לאחת מתתי המשימות שלה')
  }
}

// Filtered children become roots when their parent is outside the search/filter.
// A completed parent with unfinished children remains in the open section.
export function taskForest(tasks: Task[]): { roots: Task[]; activeRootIds: Set<string> } {
  const byId = new Map(tasks.map(task => [task.id, task]))
  const roots = tasks.filter(task => !task.parentTaskId || !byId.has(task.parentTaskId))
  const activeRootIds = new Set<string>()
  for (const task of tasks) {
    if (task.status !== 'open') continue
    let current = task
    const visited = new Set<string>()
    while (current.parentTaskId && byId.has(current.parentTaskId) && !visited.has(current.id)) {
      visited.add(current.id)
      current = byId.get(current.parentTaskId)!
    }
    activeRootIds.add(current.id)
  }
  return { roots, activeRootIds }
}
