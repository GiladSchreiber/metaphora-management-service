import { useMemo, useState, type FormEvent } from 'react'
import { CategoryField } from '../components/CategoryField'
import { PlusIcon } from '../components/icons'
import { Select } from '../components/Select'
import { Field, Modal } from '../components/ui'
import { errorMessage, formatDate, formatMoney, monthKey, monthLabel, todayISO } from '../lib/format'
import { fileToCompressedDataUrl } from '../lib/image'
import { partnerName } from '../lib/labels'
import { useAppStore } from '../store/appStore'
import type { Expense } from '../types'

interface ExpenseForm {
  id?: string
  date: string
  topic: string
  payerId: string
  categoryId: string
  amount: string
  description: string
  receiptUrl: string | null
  receiptDataUrl: string | null
  clearReceipt: boolean
}

export function CashflowPage() {
  const data = useAppStore(state => state.data)
  const saveExpense = useAppStore(state => state.saveExpense)
  const deleteExpense = useAppStore(state => state.deleteExpense)
  const [payerFilter, setPayerFilter] = useState('')
  const [editing, setEditing] = useState<ExpenseForm | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return data.expenses
      .filter(expense => !payerFilter || expense.payerId === payerFilter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [data.expenses, payerFilter])

  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0)
  const byPayer = data.partners
    .map(partner => ({
      name: partner.name,
      amount: filtered.filter(expense => expense.payerId === partner.id).reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter(item => item.amount !== 0)

  const months: { key: string; items: Expense[] }[] = []
  for (const expense of filtered) {
    const key = monthKey(expense.date)
    const last = months[months.length - 1]
    if (!last || last.key !== key) months.push({ key, items: [expense] })
    else last.items.push(expense)
  }

  function openNew() {
    setEditing({
      date: todayISO(),
      topic: '',
      payerId: data.partners[0]?.id ?? '',
      categoryId: data.categories[0]?.id ?? '',
      amount: '',
      description: '',
      receiptUrl: null,
      receiptDataUrl: null,
      clearReceipt: false,
    })
  }

  function openExisting(expense: Expense) {
    setEditing({
      id: expense.id,
      date: expense.date,
      topic: expense.topic,
      payerId: expense.payerId,
      categoryId: expense.categoryId,
      amount: String(expense.amount),
      description: expense.description,
      receiptUrl: expense.receiptUrl,
      receiptDataUrl: null,
      clearReceipt: false,
    })
  }

  const categoryName = (id: string) => data.categories.find(category => category.id === id)?.name ?? ''

  return (
    <main className="page">
      <div className="page-head">
        <h2 className="page-title">תזרים</h2>
        <button type="button" className="icon-btn" aria-label="הוצאה חדשה" onClick={openNew}>
          <PlusIcon />
        </button>
      </div>

      <div className="toolbar">
        <div className="filters">
          <Select
            ariaLabel="סינון לפי מי שילם"
            value={payerFilter}
            onChange={setPayerFilter}
            options={[
              { value: '', label: 'כל המשלמים' },
              ...data.partners.map(partner => ({ value: partner.id, label: partner.name })),
            ]}
          />
        </div>
      </div>

      <section className="stat">
        <p className="stat-sum">{formatMoney(total)}</p>
        {byPayer.length > 0 && (
          <p className="stat-split">{byPayer.map(item => `${item.name} ${formatMoney(item.amount)}`).join(' · ')}</p>
        )}
      </section>

      {months.map(month => {
        const monthTotal = month.items.reduce((sum, expense) => sum + expense.amount, 0)
        return (
          <section key={month.key} className="month">
            <div className="month-head">
              <h2>{monthLabel(month.key)}</h2>
              <span>{formatMoney(monthTotal)}</span>
            </div>
            <ul className="list">
              {month.items.map(expense => (
                <li key={expense.id}>
                  <article className="card">
                    <div className="card-top">
                      <button type="button" className="card-button" onClick={() => openExisting(expense)}>
                        <div className="card-title">{expense.topic}</div>
                        <div className="card-meta">
                          {formatDate(expense.date)} · {partnerName(data.partners, expense.payerId)} · {categoryName(expense.categoryId)}
                        </div>
                      </button>
                      <div className="card-amount">{formatMoney(expense.amount)}</div>
                    </div>
                    {expense.description && <p className="card-note">{expense.description}</p>}
                    {expense.receiptUrl && <img className="thumb" src={expense.receiptUrl} alt="קבלה" />}
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {editing && (
        <ExpenseDialog
          form={editing}
          setForm={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveExpense}
          onDelete={() => setConfirmId(editing.id ?? null)}
        />
      )}

      {confirmId && (
        <Modal title="למחוק את ההוצאה?" onClose={() => setConfirmId(null)}>
          <p>ההוצאה תימחק, כולל הקבלה אם יש.</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void deleteExpense(confirmId).then(() => {
                  setConfirmId(null)
                  setEditing(null)
                })
              }}
            >
              מחיקה
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmId(null)}>ביטול</button>
          </div>
        </Modal>
      )}
    </main>
  )
}

function ExpenseDialog({
  form,
  setForm,
  onClose,
  onSave,
  onDelete,
}: {
  form: ExpenseForm
  setForm: (form: ExpenseForm) => void
  onClose: () => void
  onSave: (input: {
    id?: string
    date: string
    topic: string
    payerId: string
    categoryId: string
    amount: number
    description: string
    receiptDataUrl?: string | null
    clearReceipt?: boolean
  }) => Promise<void>
  onDelete: () => void
}) {
  const partners = useAppStore(state => state.data.partners)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reading, setReading] = useState(false)
  const preview = form.receiptDataUrl || (!form.clearReceipt ? form.receiptUrl : null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setReading(true)
    setError('')
    try {
      const receiptDataUrl = await fileToCompressedDataUrl(file)
      setForm({ ...form, receiptDataUrl, clearReceipt: false })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setReading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(form.amount.replace(/,/g, '').trim())
    if (!form.topic.trim()) { setError('יש להזין נושא'); return }
    if (!form.date) { setError('יש לבחור תאריך'); return }
    if (!form.payerId) { setError('יש לבחור מי שילם'); return }
    if (!form.categoryId) { setError('יש לבחור קטגוריה'); return }
    if (!Number.isFinite(amount) || amount <= 0) { setError('יש להזין סכום גדול מאפס'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: form.id,
        date: form.date,
        topic: form.topic,
        payerId: form.payerId,
        categoryId: form.categoryId,
        amount,
        description: form.description,
        receiptDataUrl: form.receiptDataUrl,
        clearReceipt: form.clearReceipt && !form.receiptDataUrl,
      })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={form.id ? 'עריכת הוצאה' : 'הוצאה חדשה'} onClose={onClose}>
      <form onSubmit={event => void submit(event)}>
        {error && <p className="error">{error}</p>}
        <Field label="תאריך">
          <input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} required />
        </Field>
        <Field label="נושא">
          <input value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })} placeholder="למשל: מקדמה לשיפוץ הבר" />
        </Field>
        <Field label="מי שילם">
          <Select
            value={form.payerId}
            onChange={payerId => setForm({ ...form, payerId })}
            options={partners.map(partner => ({ value: partner.id, label: partner.name }))}
          />
        </Field>
        <CategoryField value={form.categoryId} onChange={categoryId => setForm({ ...form, categoryId })} />
        <Field label="סכום">
          <input inputMode="decimal" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} placeholder="0" />
        </Field>
        <Field label="תיאור">
          <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={3} />
        </Field>
        <Field label="קבלה">
          {preview ? (
            <div className="photo">
              <img src={preview} alt="תצוגה מקדימה של הקבלה" />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setForm({ ...form, receiptUrl: null, receiptDataUrl: null, clearReceipt: true })}
              >
                הסרת קבלה
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={reading}
              onChange={event => {
                void onFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          )}
        </Field>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || reading}>{saving ? 'שומר…' : 'שמירה'}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>ביטול</button>
          {form.id && <button className="btn btn-danger" type="button" onClick={onDelete}>מחיקה</button>}
        </div>
      </form>
    </Modal>
  )
}
