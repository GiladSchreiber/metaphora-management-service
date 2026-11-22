import { create } from 'zustand'
import { repo } from '../repositories'
import { errorMessage } from '../lib/format'
import type { AppData, ContactDraft, ExpenseDraft, Task, TaskDraft, TaskStatus } from '../types'

const empty: AppData = {
  partners: [],
  categories: [],
  expenses: [],
  tasks: [],
  contacts: [],
}

interface AppState {
  data: AppData
  loading: boolean
  loaded: boolean
  error: string
  refresh: () => Promise<void>
  savePartner: (input: { id?: string; name: string }) => Promise<void>
  deletePartner: (id: string) => Promise<void>
  saveCategory: (input: { id?: string; name: string }) => Promise<string>
  deleteCategory: (id: string) => Promise<void>
  saveExpense: (input: ExpenseDraft) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  saveTask: (input: TaskDraft) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  setSubtaskDone: (taskId: string, subtaskId: string, done: boolean) => Promise<void>
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>
  addTaskUpdate: (input: { taskId: string; body: string; partnerId: string | null }) => Promise<void>
  deleteTaskUpdate: (taskId: string, updateId: string) => Promise<void>
  saveContact: (input: ContactDraft) => Promise<void>
  deleteContact: (id: string) => Promise<void>
}

async function change(run: () => Promise<unknown>, refresh: () => Promise<void>): Promise<void> {
  await run()
  await refresh()
}

// Keep writes to the same checkbox in order, while rendering the latest click immediately.
type TaskPatch = (task: Task) => Task
interface PendingCheckbox {
  taskId: string
  patch: TaskPatch
  confirmed: TaskPatch
  tail: Promise<void>
  version: number
}
const pendingCheckboxes = new Map<string, PendingCheckbox>()
let checkboxRevision = 0
let refreshSequence = 0
let checkboxErrorRevision = 0

function patchTask(taskId: string, patch: TaskPatch) {
  useAppStore.setState(state => ({
    data: { ...state.data, tasks: state.data.tasks.map(task => task.id === taskId ? patch(task) : task) },
  }))
}

async function updateCheckbox(
  key: string, taskId: string, patch: TaskPatch, rollback: TaskPatch, persist: () => Promise<void>,
): Promise<void> {
  let entry = pendingCheckboxes.get(key)
  if (!entry) {
    entry = { taskId, patch, confirmed: rollback, tail: Promise.resolve(), version: 0 }
    pendingCheckboxes.set(key, entry)
  }
  entry.patch = patch
  const version = ++entry.version
  checkboxRevision++
  useAppStore.setState({ error: '' })
  patchTask(taskId, patch)
  const current = entry
  const operation = current.tail.then(async () => {
    try {
      await persist()
      current.confirmed = patch
    } catch (err) {
      if (current.version === version) {
        patchTask(taskId, current.confirmed)
        checkboxErrorRevision++
        useAppStore.setState({ error: `השמירה נכשלה. נסו שוב. ${errorMessage(err)}` })
      }
    } finally {
      if (current.version === version) {
        pendingCheckboxes.delete(key)
        checkboxRevision++
      }
    }
  })
  current.tail = operation
  await operation
}

export const useAppStore = create<AppState>((set, get) => ({
  data: empty,
  loading: false,
  loaded: false,
  error: '',

  refresh: async () => {
    const first = !get().loaded
    if (first) set({ loading: true, error: '' })
    try {
      const sequence = ++refreshSequence
      const revision = checkboxRevision
      const errorRevision = checkboxErrorRevision
      const data = await repo.load()
      if (sequence !== refreshSequence) return
      // A response started before a checkbox settled can contain its old value.
      if (revision !== checkboxRevision) return get().refresh()
      for (const pending of pendingCheckboxes.values()) {
        data.tasks = data.tasks.map(task => task.id === pending.taskId ? pending.patch(task) : task)
      }
      set({ data, loading: false, loaded: true, error: errorRevision === checkboxErrorRevision ? '' : get().error })
    } catch (err) {
      set({ loading: false, error: errorMessage(err) })
    }
  },

  savePartner: async input => change(() => repo.savePartner(input), get().refresh),
  deletePartner: async id => change(() => repo.deletePartner(id), get().refresh),
  saveCategory: async input => {
    const id = await repo.saveCategory(input)
    await get().refresh()
    return id
  },
  deleteCategory: async id => change(() => repo.deleteCategory(id), get().refresh),
  saveExpense: async input => change(() => repo.saveExpense(input), get().refresh),
  deleteExpense: async id => change(() => repo.deleteExpense(id), get().refresh),
  saveTask: async input => {
    const pendingStatus = input.id ? pendingCheckboxes.has(`task:${input.id}`) : false
    const pending = [...pendingCheckboxes.values()].filter(entry => entry.taskId === input.id)
    await Promise.all(pending.map(entry => entry.tail))
    // The dialog may have opened while a parent checkbox was still saving.
    const current = pendingStatus ? get().data.tasks.find(task => task.id === input.id) : undefined
    await change(() => repo.saveTask(current ? { ...input, status: current.status } : input), get().refresh)
  },
  deleteTask: async id => change(() => repo.deleteTask(id), get().refresh),
  setTaskStatus: async (id, status) => {
    const task = get().data.tasks.find(item => item.id === id)
    if (!task || task.status === status) return
    const doneAt = status === 'done' ? new Date().toISOString() : null
    await updateCheckbox(`task:${id}`, id,
      item => ({ ...item, status, doneAt }),
      item => ({ ...item, status: task.status, doneAt: task.doneAt }),
      () => repo.setTaskStatus(id, status))
  },
  setSubtaskDone: async (taskId, subtaskId, done) => {
    const subtask = get().data.tasks.find(task => task.id === taskId)?.subtasks.find(item => item.id === subtaskId)
    if (!subtask || subtask.done === done) return
    const patch = (value: boolean): TaskPatch => task => ({
      ...task,
      subtasks: task.subtasks.map(item => item.id === subtaskId ? { ...item, done: value } : item),
    })
    await updateCheckbox(`subtask:${taskId}:${subtaskId}`, taskId, patch(done), patch(subtask.done),
      () => repo.setSubtaskDone(taskId, subtaskId, done))
  },
  addTaskUpdate: async input => change(() => repo.addTaskUpdate(input), get().refresh),
  deleteTaskUpdate: async (taskId, updateId) => change(() => repo.deleteTaskUpdate(taskId, updateId), get().refresh),
  saveContact: async input => change(() => repo.saveContact(input), get().refresh),
  deleteContact: async id => change(() => repo.deleteContact(id), get().refresh),
}))
