import { buildSeed } from '../data/seed'
import { loadContactSeeds } from '../data/loadContacts'
import { assertCategoryFree, assertPartnerFree, assertUniqueName } from '../lib/guards'
import { newId } from '../lib/format'
import type {
  AppData,
  Contact,
  ContactDraft,
  Expense,
  ExpenseDraft,
  Repository,
  Task,
  TaskDraft,
  TaskStatus,
  TaskUpdate,
} from '../types'

const STORAGE_KEY = 'metaphora.v1'

function seed(): AppData {
  return buildSeed(loadContactSeeds())
}

function read(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return write(seed())
  try {
    const parsed = JSON.parse(raw) as AppData
    if (!parsed.partners || !parsed.categories || !parsed.tasks || !parsed.expenses || !parsed.contacts) {
      return write(seed())
    }
    return parsed
  } catch {
    return write(seed())
  }
}

function write(data: AppData): AppData {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    throw new Error('הדפדפן מלא. מחקו תמונות ישנות, או חברו Supabase לאחסון.')
  }
  return data
}

function nextOrder(items: { sortOrder: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1
}

export class MockRepository implements Repository {
  async load(): Promise<AppData> {
    const data = read()
    return {
      ...data,
      partners: [...data.partners].sort((a, b) => a.sortOrder - b.sortOrder),
      categories: [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    }
  }

  async savePartner(input: { id?: string; name: string }): Promise<void> {
    const data = read()
    const name = assertUniqueName(data.partners, input.name, input.id)
    if (input.id) {
      const partner = data.partners.find(item => item.id === input.id)
      if (!partner) throw new Error('השותף לא נמצא')
      partner.name = name
    } else {
      data.partners.push({ id: newId('p'), name, sortOrder: nextOrder(data.partners) })
    }
    write(data)
  }

  async deletePartner(id: string): Promise<void> {
    const data = read()
    assertPartnerFree(data, id)
    data.partners = data.partners.filter(partner => partner.id !== id)
    write(data)
  }

  async saveCategory(input: { id?: string; name: string }): Promise<string> {
    const data = read()
    const name = assertUniqueName(data.categories, input.name, input.id)
    if (input.id) {
      const category = data.categories.find(item => item.id === input.id)
      if (!category) throw new Error('הקטגוריה לא נמצאה')
      category.name = name
      write(data)
      return category.id
    }
    const category = { id: newId('cat'), name, sortOrder: nextOrder(data.categories) }
    data.categories.push(category)
    write(data)
    return category.id
  }

  async deleteCategory(id: string): Promise<void> {
    const data = read()
    assertCategoryFree(data, id)
    data.categories = data.categories.filter(category => category.id !== id)
    write(data)
  }

  async saveExpense(input: ExpenseDraft): Promise<void> {
    const data = read()
    const existing = input.id ? data.expenses.find(expense => expense.id === input.id) : undefined
    if (input.id && !existing) throw new Error('ההוצאה לא נמצאה')
    let receiptUrl = existing?.receiptUrl ?? null
    if (input.clearReceipt) receiptUrl = null
    if (input.receiptDataUrl) receiptUrl = input.receiptDataUrl
    const expense: Expense = {
      id: existing?.id ?? newId('exp'),
      date: input.date,
      topic: input.topic.trim(),
      payerId: input.payerId,
      categoryId: input.categoryId,
      amount: input.amount,
      description: input.description.trim(),
      receiptUrl,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    data.expenses = existing
      ? data.expenses.map(item => item.id === expense.id ? expense : item)
      : [expense, ...data.expenses]
    write(data)
  }

  async deleteExpense(id: string): Promise<void> {
    const data = read()
    data.expenses = data.expenses.filter(expense => expense.id !== id)
    write(data)
  }

  async saveTask(input: TaskDraft): Promise<void> {
    const data = read()
    const existing = input.id ? data.tasks.find(task => task.id === input.id) : undefined
    if (input.id && !existing) throw new Error('המשימה לא נמצאה')
    let photoUrl = existing?.photoUrl ?? null
    if (input.clearPhoto) photoUrl = null
    if (input.photoDataUrl) photoUrl = input.photoDataUrl
    const doneAt = input.status === 'done'
      ? existing?.doneAt ?? new Date().toISOString()
      : null
    const task: Task = {
      id: existing?.id ?? newId('task'),
      topic: input.topic.trim(),
      description: input.description.trim(),
      categoryId: input.categoryId,
      ownerIds: [...new Set(input.ownerIds)],
      urgency: input.urgency,
      status: input.status,
      doneAt,
      photoUrl,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updates: existing?.updates ?? [],
    }
    data.tasks = existing
      ? data.tasks.map(item => item.id === task.id ? task : item)
      : [task, ...data.tasks]
    write(data)
  }

  async deleteTask(id: string): Promise<void> {
    const data = read()
    data.tasks = data.tasks.filter(task => task.id !== id)
    write(data)
  }

  async setTaskStatus(id: string, status: TaskStatus): Promise<void> {
    const data = read()
    const task = data.tasks.find(item => item.id === id)
    if (!task) throw new Error('המשימה לא נמצאה')
    task.status = status
    task.doneAt = status === 'done' ? task.doneAt ?? new Date().toISOString() : null
    write(data)
  }

  async addTaskUpdate(input: { taskId: string; body: string; partnerId: string | null }): Promise<void> {
    const data = read()
    const task = data.tasks.find(item => item.id === input.taskId)
    if (!task) throw new Error('המשימה לא נמצאה')
    const update: TaskUpdate = {
      id: newId('upd'),
      body: input.body.trim(),
      partnerId: input.partnerId,
      createdAt: new Date().toISOString(),
    }
    task.updates = [...task.updates, update]
    write(data)
  }

  async deleteTaskUpdate(taskId: string, updateId: string): Promise<void> {
    const data = read()
    const task = data.tasks.find(item => item.id === taskId)
    if (!task) throw new Error('המשימה לא נמצאה')
    task.updates = task.updates.filter(update => update.id !== updateId)
    write(data)
  }

  async saveContact(input: ContactDraft): Promise<void> {
    const data = read()
    const existing = input.id ? data.contacts.find(contact => contact.id === input.id) : undefined
    if (input.id && !existing) throw new Error('איש הקשר לא נמצא')
    const contact: Contact = {
      id: existing?.id ?? newId('contact'),
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role.trim(),
      email: input.email.trim(),
      notes: input.notes.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    data.contacts = existing
      ? data.contacts.map(item => item.id === contact.id ? contact : item)
      : [contact, ...data.contacts]
    write(data)
  }

  async deleteContact(id: string): Promise<void> {
    const data = read()
    data.contacts = data.contacts.filter(contact => contact.id !== id)
    write(data)
  }
}
