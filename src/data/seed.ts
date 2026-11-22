import { contactDetails } from '../lib/contactDetails'
import { parseTaskCell } from '../lib/parseTaskCell'
import type { AppData, Category, Partner, Task } from '../types'

export const PARTNERS: Partner[] = [
  { id: 'p-gilad', name: 'גלעד', sortOrder: 0 },
  { id: 'p-noam', name: 'נועם', sortOrder: 1 },
  { id: 'p-ariel', name: 'אריאל', sortOrder: 2 },
]

// Columns from the spreadsheet tab "מטאפורה". Empty columns are omitted.
// Expense categories that are not already on that tab are appended.
const TASK_COLUMNS: { category: string; cells: string[] }[] = [
  {
    category: 'עסקה',
    cells: [
      'זכרון דברים - עסק (נועם)',
      'פתיחת חברה (נועם)',
      'פתיחת חשבון בנק (נועם)',
      'מעבר על חוזה קיים (כולם)',
      'חוזה על המחסן',
      'תכנית עסקית',
    ],
  },
  {
    category: 'פתיחת חברה',
    cells: [
      'חשבון גוגל (גלעד)',
      'מספר וואטסאפ (נועם)',
      '150,000 לחשבון הבנק (נועם+גלעד)',
    ],
  },
  {
    category: 'שותפות',
    cells: [
      'זכרון דברים - שותפים (גלעד)',
      'חוזה שותפים',
    ],
  },
  {
    category: 'רישוי',
    cells: [
      'העברת רשיון עסק',
      'העברת רשיון חוץ',
      'העברת ארנונה',
      'העברת חשמל',
      'העברת מים',
      'העברת אינטרנט',
      'אקו״ם',
      'מצלמות אבטחה',
      'העברת סושיאל',
      'ביטוח עסק',
      'העברת חשבון מוזיקה',
      'קופה ומסוף אשראי',
      'חברת סליקה',
    ],
  },
  {
    category: 'כוח אדם',
    cells: [
      'רואה חשבון (נועם)',
      'סושיאל',
      'תנאי שכר עובדים',
      'גיוס צוות (אריאל + נועם)',
      'הקמת מטבח (אריאל+נועם)',
    ],
  },
  { category: 'תחזוקה וציוד', cells: [] },
  {
    category: 'ספקים',
    cells: [
      'ספק אלכוהול',
      'בשרים',
      'גבינות וחלב',
      'תחליפי חלב',
      'שימורים',
      'טואלטיקה',
      'בצקים',
      'שתייה קלה',
      'ספק קפה',
      'ספק ירקות',
      'קונדיטוריה',
    ],
  },
  {
    category: 'שוטף',
    cells: [
      'בניית תפריט מטבח',
      'בניית תפריט קפה',
      'בניית תפריט בר (אריאל)',
      'החלפת מנעולים',
      'ניקיון וסידור',
      'הדפסת תפריטים',
      'נהלי משמרת',
      'מיקום סחורות',
      'אתר לניהול עסק (גלעד)',
    ],
  },
]

const EXTRA_CATEGORIES = ['חוזה', 'שיפוצים', 'צוות']

export interface ContactSeed {
  name: string
  phone: string
  role: string
  email: string
  notes: string
}

export function buildCategories(): Category[] {
  const names = [
    ...TASK_COLUMNS.map(column => column.category),
    ...EXTRA_CATEGORIES,
  ]
  return names.map((name, index) => ({
    id: `cat-${String(index + 1).padStart(2, '0')}`,
    name,
    sortOrder: index,
  }))
}

export function buildTasks(categories: Category[]): Task[] {
  const byName = new Map(categories.map(category => [category.name, category.id]))
  const tasks: Task[] = []
  let index = 0
  TASK_COLUMNS.forEach((column, columnIndex) => {
    const categoryId = byName.get(column.category)
    if (!categoryId) return
    column.cells.forEach((cell, cellIndex) => {
      const parsed = parseTaskCell(cell, PARTNERS)
      const createdAt = new Date(Date.UTC(2026, 10, 7, 8, 0, index)).toISOString()
      tasks.push({
        id: `task-${String(columnIndex + 1).padStart(2, '0')}-${String(cellIndex + 1).padStart(2, '0')}`,
        parentTaskId: null,
        topic: parsed.topic,
        description: '',
        categoryId,
        ownerIds: parsed.ownerIds,
        urgency: 'medium',
        status: 'open',
        doneAt: null,
        photoUrl: null,
        createdAt,
        detailsMode: null,
        subtasks: [],
        updates: [],
      })
      index += 1
    })
  })
  return tasks
}

export function buildSeed(contacts: ContactSeed[]): AppData {
  const categories = buildCategories()
  const createdAt = '2026-11-07T08:00:00.000Z'
  return {
    partners: PARTNERS.map(partner => ({ ...partner })),
    categories,
    expenses: [],
    tasks: buildTasks(categories),
    contacts: contacts.map((contact, index) => ({
      ...contactDetails(),
      id: `contact-${String(index + 1).padStart(2, '0')}`,
      name: contact.name,
      phone: contact.phone,
      role: contact.role,
      email: contact.email,
      notes: contact.notes,
      createdAt,
    })),
  }
}
