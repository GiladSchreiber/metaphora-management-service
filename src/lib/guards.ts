import type { AppData, NamedRecord } from '../types'

export function assertUniqueName(records: NamedRecord[], name: string, ignoreId?: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('יש להזין שם')
  if (records.some(record => record.name.trim() === trimmed && record.id !== ignoreId)) {
    throw new Error('השם כבר קיים')
  }
  return trimmed
}

export function assertPartnerFree(data: AppData, id: string): void {
  const usedByExpense = data.expenses.some(expense => expense.payerId === id)
  const usedByTask = data.tasks.some(task =>
    task.ownerIds.includes(id) || task.updates.some(update => update.partnerId === id),
  )
  if (usedByExpense || usedByTask) {
    throw new Error('אי אפשר למחוק שותף שמשויך לתזרים, למשימה או לעדכון')
  }
}

export function assertCategoryFree(data: AppData, id: string): void {
  const used = data.expenses.some(expense => expense.categoryId === id)
    || data.tasks.some(task => task.categoryId === id)
  if (used) throw new Error('אי אפשר למחוק קטגוריה שבשימוש')
}
