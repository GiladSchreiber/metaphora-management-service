import { describe, expect, it } from 'vitest'
import { taskDetailsMode } from './taskDetails'

describe('task detail choices', () => {
  it('keeps a simple task without either section', () => {
    expect(taskDetailsMode({ subtasks: [], updates: [] })).toBeNull()
  })

  it('infers choices for legacy checklist and update tasks', () => {
    expect(taskDetailsMode({ subtasks: [{}], updates: [] })).toBe('checklist')
    expect(taskDetailsMode({ subtasks: [], updates: [{}] })).toBe('updates')
  })

  it('uses the checklist as the primary section for legacy tasks with both', () => {
    expect(taskDetailsMode({ subtasks: [{}], updates: [{}] })).toBe('checklist')
  })

  it('retains an explicit choice when the last item is removed', () => {
    expect(taskDetailsMode({ detailsMode: 'checklist', subtasks: [], updates: [] })).toBe('checklist')
    expect(taskDetailsMode({ detailsMode: 'updates', subtasks: [], updates: [] })).toBe('updates')
  })
})
