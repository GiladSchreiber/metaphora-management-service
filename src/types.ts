export type Urgency = 'low' | 'medium' | 'high'
export type TaskStatus = 'open' | 'done'
export type TaskDetailsMode = 'checklist' | 'updates' | null

export interface NamedRecord {
  id: string
  name: string
  sortOrder: number
}

export type Partner = NamedRecord
export type Category = NamedRecord

export interface Expense {
  id: string
  date: string
  topic: string
  payerId: string
  categoryId: string
  amount: number
  description: string
  receiptUrl: string | null
  createdAt: string
}

export interface TaskUpdate {
  id: string
  body: string
  partnerId: string | null
  createdAt: string
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  topic: string
  description: string
  categoryId: string
  ownerIds: string[]
  urgency: Urgency
  status: TaskStatus
  doneAt: string | null
  photoUrl: string | null
  createdAt: string
  detailsMode: TaskDetailsMode
  subtasks: Subtask[]
  updates: TaskUpdate[]
}

export interface Contact {
  id: string
  name: string
  phone: string
  role: string
  email: string
  notes: string
  createdAt: string
}

export interface AppData {
  partners: Partner[]
  categories: Category[]
  expenses: Expense[]
  tasks: Task[]
  contacts: Contact[]
}

export interface ExpenseDraft {
  id?: string
  date: string
  topic: string
  payerId: string
  categoryId: string
  amount: number
  description: string
  receiptDataUrl?: string | null
  clearReceipt?: boolean
}

export interface TaskDraft {
  id?: string
  topic: string
  description: string
  categoryId: string
  ownerIds: string[]
  urgency: Urgency
  status: TaskStatus
  detailsMode?: TaskDetailsMode
  subtasks?: Subtask[]
  photoDataUrl?: string | null
  clearPhoto?: boolean
}

export interface ContactDraft {
  id?: string
  name: string
  phone: string
  role: string
  email: string
  notes: string
}

export interface Repository {
  load(): Promise<AppData>
  savePartner(input: { id?: string; name: string }): Promise<void>
  deletePartner(id: string): Promise<void>
  saveCategory(input: { id?: string; name: string }): Promise<string>
  deleteCategory(id: string): Promise<void>
  saveExpense(input: ExpenseDraft): Promise<void>
  deleteExpense(id: string): Promise<void>
  saveTask(input: TaskDraft): Promise<string>
  deleteTask(id: string): Promise<void>
  setSubtaskDone(taskId: string, subtaskId: string, done: boolean): Promise<void>
  setTaskStatus(id: string, status: TaskStatus): Promise<void>
  addTaskUpdate(input: { taskId: string; body: string; partnerId: string | null }): Promise<void>
  deleteTaskUpdate(taskId: string, updateId: string): Promise<void>
  saveContact(input: ContactDraft): Promise<void>
  deleteContact(id: string): Promise<void>
}
