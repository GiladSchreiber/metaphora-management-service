import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSeed } from '../data/seed'
import { loadContactSeeds } from '../data/loadContacts'
import { assertCategoryFree, assertPartnerFree, assertUniqueName } from '../lib/guards'
import { dataUrlExtension, dataUrlToBlob } from '../lib/image'
import { errorMessage, newId } from '../lib/format'
import type {
  AppData,
  ContactDraft,
  ExpenseDraft,
  Repository,
  Subtask,
  TaskDraft,
  TaskStatus,
  TaskUpdate,
  Urgency,
} from '../types'

const BUCKET = 'attachments'

interface PartnerRow { id: string; name: string; sort_order: number }
interface CategoryRow { id: string; name: string; sort_order: number }
interface ExpenseRow {
  id: string
  date: string
  topic: string
  payer_id: string
  category_id: string
  amount: number | string
  description: string | null
  receipt_url: string | null
  created_at: string
}
interface TaskRow {
  id: string
  topic: string
  description: string | null
  category_id: string
  urgency: Urgency
  status: TaskStatus
  done_at: string | null
  photo_url: string | null
  subtasks?: Subtask[]
  created_at: string
}
interface OwnerRow { task_id: string; partner_id: string }
interface UpdateRow {
  id: string
  task_id: string
  body: string
  partner_id: string | null
  created_at: string
}
interface ContactRow {
  id: string
  name: string
  phone: string
  role: string
  email: string
  notes: string
  created_at: string
}

function throwIf(error: { message: string; code?: string } | null): void {
  if (!error) return
  if (error.code === '23505') throw new Error('השם כבר קיים')
  throw new Error(error.message)
}

function nextOrder(items: { sortOrder: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1
}

function storagePath(url: string | null): string | null {
  if (!url || url.startsWith('data:')) return null
  const marker = `/${BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0] ?? '')
}

export class SupabaseRepository implements Repository {
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async load(): Promise<AppData> {
    try {
      await this.ensureSeed()
      return await this.fetchAll()
    } catch (err) {
      const message = errorMessage(err)
      if (/relation|schema cache|does not exist|app_meta|PGRST/i.test(message)) {
        throw new Error('לא הצלחתי לקרוא מהמסד. בפרויקט חדש הריצו את supabase/schema.sql בעורך ה-SQL.')
      }
      throw err instanceof Error ? err : new Error(message)
    }
  }

  async savePartner(input: { id?: string; name: string }): Promise<void> {
    const data = await this.fetchAll()
    const name = assertUniqueName(data.partners, input.name, input.id)
    if (input.id) {
      const { error } = await this.supabase.from('partners').update({ name }).eq('id', input.id)
      throwIf(error)
      return
    }
    const { error } = await this.supabase.from('partners').insert({
      id: newId('p'),
      name,
      sort_order: nextOrder(data.partners),
    })
    throwIf(error)
  }

  async deletePartner(id: string): Promise<void> {
    const data = await this.fetchAll()
    assertPartnerFree(data, id)
    const { error } = await this.supabase.from('partners').delete().eq('id', id)
    throwIf(error)
  }

  async saveCategory(input: { id?: string; name: string }): Promise<string> {
    const data = await this.fetchAll()
    const name = assertUniqueName(data.categories, input.name, input.id)
    if (input.id) {
      const { error } = await this.supabase.from('categories').update({ name }).eq('id', input.id)
      throwIf(error)
      return input.id
    }
    const id = newId('cat')
    const { error } = await this.supabase.from('categories').insert({
      id,
      name,
      sort_order: nextOrder(data.categories),
    })
    throwIf(error)
    return id
  }

  async deleteCategory(id: string): Promise<void> {
    const data = await this.fetchAll()
    assertCategoryFree(data, id)
    const { error } = await this.supabase.from('categories').delete().eq('id', id)
    throwIf(error)
  }

  async saveExpense(input: ExpenseDraft): Promise<void> {
    const data = await this.fetchAll()
    const existing = input.id ? data.expenses.find(expense => expense.id === input.id) : undefined
    if (input.id && !existing) throw new Error('ההוצאה לא נמצאה')
    const id = existing?.id ?? newId('exp')
    let receiptUrl = existing?.receiptUrl ?? null
    if (input.clearReceipt) {
      await this.removeFile(receiptUrl)
      receiptUrl = null
    }
    if (input.receiptDataUrl) {
      const path = `expenses/${id}.${dataUrlExtension(input.receiptDataUrl)}`
      if (receiptUrl && storagePath(receiptUrl) !== path) await this.removeFile(receiptUrl)
      receiptUrl = await this.storeFile(path, input.receiptDataUrl)
    }
    const row = {
      id,
      date: input.date,
      topic: input.topic.trim(),
      payer_id: input.payerId,
      category_id: input.categoryId,
      amount: input.amount,
      description: input.description.trim(),
      receipt_url: receiptUrl,
      created_at: existing?.createdAt ?? new Date().toISOString(),
    }
    const { error } = await this.supabase.from('expenses').upsert(row)
    throwIf(error)
  }

  async deleteExpense(id: string): Promise<void> {
    const data = await this.fetchAll()
    const existing = data.expenses.find(expense => expense.id === id)
    await this.removeFile(existing?.receiptUrl ?? null)
    const { error } = await this.supabase.from('expenses').delete().eq('id', id)
    throwIf(error)
  }

  async saveTask(input: TaskDraft): Promise<void> {
    const data = await this.fetchAll()
    const existing = input.id ? data.tasks.find(task => task.id === input.id) : undefined
    if (input.id && !existing) throw new Error('המשימה לא נמצאה')
    const id = existing?.id ?? newId('task')
    let photoUrl = existing?.photoUrl ?? null
    if (input.clearPhoto) {
      await this.removeFile(photoUrl)
      photoUrl = null
    }
    if (input.photoDataUrl) {
      photoUrl = await this.storeFile(`tasks/${id}.jpg`, input.photoDataUrl)
    }
    const doneAt = input.status === 'done'
      ? existing?.doneAt ?? new Date().toISOString()
      : null
    const { error } = await this.supabase.from('tasks').upsert({
      id,
      topic: input.topic.trim(),
      description: input.description.trim(),
      category_id: input.categoryId,
      urgency: input.urgency,
      status: input.status,
      done_at: doneAt,
      photo_url: photoUrl,
      subtasks: (input.subtasks ?? existing?.subtasks ?? []).map(item => ({ ...item, title: item.title.trim() })),
      created_at: existing?.createdAt ?? new Date().toISOString(),
    })
    throwIf(error)
    const { error: deleteOwnersError } = await this.supabase.from('task_owners').delete().eq('task_id', id)
    throwIf(deleteOwnersError)
    const owners = [...new Set(input.ownerIds)].map(partnerId => ({ task_id: id, partner_id: partnerId }))
    if (owners.length > 0) {
      const { error: ownersError } = await this.supabase.from('task_owners').insert(owners)
      throwIf(ownersError)
    }
  }

  async deleteTask(id: string): Promise<void> {
    const data = await this.fetchAll()
    const existing = data.tasks.find(task => task.id === id)
    await this.removeFile(existing?.photoUrl ?? null)
    const { error } = await this.supabase.from('tasks').delete().eq('id', id)
    throwIf(error)
  }

  async setTaskStatus(id: string, status: TaskStatus): Promise<void> {
    const { data, error } = await this.supabase.from('tasks').update({
      status,
      done_at: status === 'done' ? new Date().toISOString() : null,
    }).eq('id', id).select('id').single()
    throwIf(error)
    if (!data) throw new Error('המשימה לא נמצאה')
  }

  async setSubtaskDone(taskId: string, subtaskId: string, done: boolean): Promise<void> {
    const { error } = await this.supabase.rpc('set_task_subtask_done', {
      task_id: taskId,
      subtask_id: subtaskId,
      is_done: done,
    })
    throwIf(error)
  }

  async addTaskUpdate(input: { taskId: string; body: string; partnerId: string | null }): Promise<void> {
    const { error } = await this.supabase.from('task_updates').insert({
      id: newId('upd'),
      task_id: input.taskId,
      body: input.body.trim(),
      partner_id: input.partnerId,
      created_at: new Date().toISOString(),
    })
    throwIf(error)
  }

  async deleteTaskUpdate(taskId: string, updateId: string): Promise<void> {
    const { error } = await this.supabase.from('task_updates').delete().eq('id', updateId).eq('task_id', taskId)
    throwIf(error)
  }

  async saveContact(input: ContactDraft): Promise<void> {
    const data = await this.fetchAll()
    const existing = input.id ? data.contacts.find(contact => contact.id === input.id) : undefined
    if (input.id && !existing) throw new Error('איש הקשר לא נמצא')
    const { error } = await this.supabase.from('contacts').upsert({
      id: existing?.id ?? newId('contact'),
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role.trim(),
      email: input.email.trim(),
      notes: input.notes.trim(),
      created_at: existing?.createdAt ?? new Date().toISOString(),
    })
    throwIf(error)
  }

  async deleteContact(id: string): Promise<void> {
    const { error } = await this.supabase.from('contacts').delete().eq('id', id)
    throwIf(error)
  }

  private async ensureSeed(): Promise<void> {
    const meta = await this.readMeta()
    if (meta.tasks_seeded !== '1') {
      const seed = buildSeed([])
      const { error: partnersError } = await this.supabase.from('partners').upsert(
        seed.partners.map(partner => ({ id: partner.id, name: partner.name, sort_order: partner.sortOrder })),
      )
      throwIf(partnersError)
      const { error: categoriesError } = await this.supabase.from('categories').upsert(
        seed.categories.map(category => ({ id: category.id, name: category.name, sort_order: category.sortOrder })),
      )
      throwIf(categoriesError)
      const { error: tasksError } = await this.supabase.from('tasks').upsert(seed.tasks.map(task => ({
        id: task.id,
        topic: task.topic,
        description: task.description,
        category_id: task.categoryId,
        urgency: task.urgency,
        status: task.status,
        done_at: task.doneAt,
        photo_url: task.photoUrl,
        created_at: task.createdAt,
      })))
      throwIf(tasksError)
      const owners = seed.tasks.flatMap(task =>
        task.ownerIds.map(partnerId => ({ task_id: task.id, partner_id: partnerId })),
      )
      if (owners.length > 0) {
        const { error: ownersError } = await this.supabase.from('task_owners').upsert(owners)
        throwIf(ownersError)
      }
      await this.writeMeta('tasks_seeded', '1')
    }

    const contactSeeds = loadContactSeeds()
    if (contactSeeds.length > 0 && meta.contacts_seeded !== '1') {
      const { count, error } = await this.supabase.from('contacts').select('id', { count: 'exact', head: true })
      throwIf(error)
      if (!count) {
        const contacts = buildSeed(contactSeeds).contacts
        const { error: insertError } = await this.supabase.from('contacts').upsert(contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          role: contact.role,
          email: contact.email,
          notes: contact.notes,
          created_at: contact.createdAt,
        })))
        throwIf(insertError)
      }
      await this.writeMeta('contacts_seeded', '1')
    }
  }

  private async fetchAll(): Promise<AppData> {
    const [partners, categories, expenses, tasks, owners, updates, contacts] = await Promise.all([
      this.select<PartnerRow>('partners'),
      this.select<CategoryRow>('categories'),
      this.select<ExpenseRow>('expenses'),
      this.select<TaskRow>('tasks'),
      this.select<OwnerRow>('task_owners'),
      this.select<UpdateRow>('task_updates'),
      this.select<ContactRow>('contacts'),
    ])

    const ownersByTask = new Map<string, string[]>()
    for (const owner of owners) {
      const list = ownersByTask.get(owner.task_id) ?? []
      list.push(owner.partner_id)
      ownersByTask.set(owner.task_id, list)
    }
    const updatesByTask = new Map<string, TaskUpdate[]>()
    for (const update of updates) {
      const list = updatesByTask.get(update.task_id) ?? []
      list.push({
        id: update.id,
        body: update.body,
        partnerId: update.partner_id,
        createdAt: update.created_at,
      })
      updatesByTask.set(update.task_id, list)
    }
    for (const list of updatesByTask.values()) {
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }

    return {
      partners: partners
        .map(row => ({ id: row.id, name: row.name, sortOrder: row.sort_order }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      categories: categories
        .map(row => ({ id: row.id, name: row.name, sortOrder: row.sort_order }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      expenses: expenses.map(row => ({
        id: row.id,
        date: row.date,
        topic: row.topic,
        payerId: row.payer_id,
        categoryId: row.category_id,
        amount: Number(row.amount),
        description: row.description ?? '',
        receiptUrl: row.receipt_url,
        createdAt: row.created_at,
      })),
      tasks: tasks.map(row => ({
        id: row.id,
        topic: row.topic,
        description: row.description ?? '',
        categoryId: row.category_id,
        ownerIds: ownersByTask.get(row.id) ?? [],
        urgency: row.urgency,
        status: row.status,
        doneAt: row.done_at,
        photoUrl: row.photo_url,
        createdAt: row.created_at,
        subtasks: row.subtasks ?? [],
        updates: updatesByTask.get(row.id) ?? [],
      })),
      contacts: contacts.map(row => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        role: row.role,
        email: row.email,
        notes: row.notes,
        createdAt: row.created_at,
      })),
    }
  }

  private async select<T>(table: string): Promise<T[]> {
    const { data, error } = await this.supabase.from(table).select('*')
    throwIf(error)
    return (data ?? []) as T[]
  }

  private async readMeta(): Promise<Record<string, string>> {
    const { data, error } = await this.supabase.from('app_meta').select('key, value')
    throwIf(error)
    const meta: Record<string, string> = {}
    for (const row of data ?? []) meta[row.key as string] = row.value as string
    return meta
  }

  private async writeMeta(key: string, value: string): Promise<void> {
    const { error } = await this.supabase.from('app_meta').upsert({ key, value })
    throwIf(error)
  }

  private async storeFile(path: string, dataUrl: string): Promise<string> {
    const blob = dataUrlToBlob(dataUrl)
    const { error } = await this.supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg',
    })
    if (error) {
      throw new Error('העלאת הקובץ נכשלה. הריצו את חלק האחסון ב-supabase/schema.sql.')
    }
    const { data } = this.supabase.storage.from(BUCKET).getPublicUrl(path)
    return `${data.publicUrl}?v=${Date.now()}`
  }

  private async removeFile(url: string | null): Promise<void> {
    const path = storagePath(url)
    if (!path) return
    await this.supabase.storage.from(BUCKET).remove([path])
  }
}
