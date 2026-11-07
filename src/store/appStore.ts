import { create } from 'zustand'
import { repo } from '../repositories'
import { errorMessage } from '../lib/format'
import type { AppData, ContactDraft, ExpenseDraft, TaskDraft, TaskStatus } from '../types'

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

export const useAppStore = create<AppState>((set, get) => ({
  data: empty,
  loading: false,
  loaded: false,
  error: '',

  refresh: async () => {
    const first = !get().loaded
    if (first) set({ loading: true, error: '' })
    try {
      const data = await repo.load()
      set({ data, loading: false, loaded: true, error: '' })
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
  saveTask: async input => change(() => repo.saveTask(input), get().refresh),
  deleteTask: async id => change(() => repo.deleteTask(id), get().refresh),
  setTaskStatus: async (id, status) => change(() => repo.setTaskStatus(id, status), get().refresh),
  addTaskUpdate: async input => change(() => repo.addTaskUpdate(input), get().refresh),
  deleteTaskUpdate: async (taskId, updateId) => change(() => repo.deleteTaskUpdate(taskId, updateId), get().refresh),
  saveContact: async input => change(() => repo.saveContact(input), get().refresh),
  deleteContact: async id => change(() => repo.deleteContact(id), get().refresh),
}))
