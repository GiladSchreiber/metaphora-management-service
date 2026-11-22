import type { TaskDetailsMode } from '../types'

// Infer the mode for tasks saved before the choice was introduced.
export function taskDetailsMode(task: {
  detailsMode?: TaskDetailsMode
  subtasks: unknown[]
  updates: unknown[]
}): TaskDetailsMode {
  if (task.detailsMode != null) return task.detailsMode
  if (task.subtasks.length > 0) return 'checklist'
  if (task.updates.length > 0) return 'updates'
  return null
}
