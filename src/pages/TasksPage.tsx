import { useMemo, useState, type FormEvent } from 'react'
import { CategoryField } from '../components/CategoryField'
import { PlusIcon, SearchIcon } from '../components/icons'
import { Select } from '../components/Select'
import { Field, Modal } from '../components/ui'
import { errorMessage, formatWhen } from '../lib/format'
import { ownerLabel, partnerName, URGENCY_LABELS } from '../lib/labels'
import { useAppStore } from '../store/appStore'
import type { Task, TaskDraft, TaskStatus, Urgency } from '../types'

const URGENCY_RANK: Record<Urgency, number> = { high: 0, medium: 1, low: 2 }

function urgencyRank(urgency: Urgency): number {
  return URGENCY_RANK[urgency]
}

interface TaskForm {
  id?: string
  topic: string
  description: string
  categoryId: string
  ownerIds: string[]
  urgency: Urgency
  status: TaskStatus
}

export function TasksPage() {
  const data = useAppStore(state => state.data)
  const saveTask = useAppStore(state => state.saveTask)
  const deleteTask = useAppStore(state => state.deleteTask)
  const setTaskStatus = useAppStore(state => state.setTaskStatus)
  const addTaskUpdate = useAppStore(state => state.addTaskUpdate)
  const deleteTaskUpdate = useAppStore(state => state.deleteTaskUpdate)

  const [ownerFilter, setOwnerFilter] = useState('')
  const [topicQuery, setTopicQuery] = useState('')
  const [doneOpen, setDoneOpen] = useState(false)
  const [editing, setEditing] = useState<TaskForm | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const query = topicQuery.trim()
    return data.tasks.filter(task => {
      if (ownerFilter === 'none' && task.ownerIds.length > 0) return false
      if (ownerFilter && ownerFilter !== 'none' && !task.ownerIds.includes(ownerFilter)) return false
      if (query && !`${task.topic} ${task.description}`.includes(query)) return false
      return true
    })
  }, [data.tasks, ownerFilter, topicQuery])

  const openTasks = filtered.filter(task => task.status === 'open')
  const doneTasks = filtered
    .filter(task => task.status === 'done')
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))

  function openNew() {
    setEditing({
      topic: '',
      description: '',
      categoryId: data.categories[0]?.id ?? '',
      ownerIds: [],
      urgency: 'medium',
      status: 'open',
    })
  }

  function openExisting(task: Task) {
    setEditing({
      id: task.id,
      topic: task.topic,
      description: task.description,
      categoryId: task.categoryId,
      ownerIds: task.ownerIds,
      urgency: task.urgency,
      status: task.status,
    })
  }

  const liveTask = editing?.id ? data.tasks.find(task => task.id === editing.id) : undefined

  return (
    <main className="page">
      <div className="page-head">
        <h2 className="page-title">משימות</h2>
        <div className="page-tools">
          <label className="icon-search">
            <span className="icon-search-hint" aria-hidden="true"><SearchIcon /></span>
            <input aria-label="חיפוש" value={topicQuery} onChange={event => setTopicQuery(event.target.value)} />
          </label>
          <button type="button" className="icon-btn" aria-label="משימה חדשה" onClick={openNew}>
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <Select
            ariaLabel="סינון לפי אחראי"
            value={ownerFilter}
            onChange={setOwnerFilter}
            options={[
              { value: '', label: 'כל האחראים' },
              { value: 'none', label: 'לא משויך' },
              ...data.partners.map(partner => ({ value: partner.id, label: partner.name })),
            ]}
          />
        </div>
      </div>

      {data.categories.map(category => {
        const items = openTasks
          .filter(task => task.categoryId === category.id)
          .sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency) || a.createdAt.localeCompare(b.createdAt))
        if (items.length === 0) return null
        return (
          <section key={category.id} className="group">
            <h3>{category.name}</h3>
            <ul className="list">
              {items.map(task => (
                <TaskRow key={task.id} task={task} onOpen={openExisting} onToggle={setTaskStatus} />
              ))}
            </ul>
          </section>
        )
      })}

      {openTasks.length === 0 && <p className="empty">אין משימות פתוחות בסינון הזה.</p>}

      <section className="done-block">
        <button type="button" className="group-head" onClick={() => setDoneOpen(open => !open)}>
          <span>{doneOpen ? '▾' : '◂'} בוצעו ({doneTasks.length})</span>
        </button>
        {doneOpen && (
          <ul className="list">
            {doneTasks.map(task => (
              <TaskRow key={task.id} task={task} onOpen={openExisting} onToggle={setTaskStatus} />
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <TaskDialog
          form={editing}
          updates={liveTask?.updates ?? []}
          setForm={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveTask}
          onDelete={() => editing.id && setConfirmId(editing.id)}
          onAddUpdate={addTaskUpdate}
          onDeleteUpdate={deleteTaskUpdate}
        />
      )}

      {confirmId && (
        <Modal title="למחוק את המשימה?" onClose={() => setConfirmId(null)}>
          <p>המשימה והעדכונים שלה יימחקו.</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void deleteTask(confirmId).then(() => {
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

function TaskRow({
  task,
  onOpen,
  onToggle,
}: {
  task: Task
  onOpen: (task: Task) => void
  onToggle: (id: string, status: TaskStatus) => Promise<void>
}) {
  const partners = useAppStore(state => state.data.partners)
  const categories = useAppStore(state => state.data.categories)
  const category = categories.find(item => item.id === task.categoryId)?.name
  const done = task.status === 'done'
  return (
    <li className={done ? 'task-row task-done' : 'task-row'}>
      <input
        className="check"
        type="checkbox"
        checked={done}
        aria-label={done ? 'החזרה לפתוחות' : 'סימון כבוצע'}
        onChange={() => void onToggle(task.id, done ? 'open' : 'done')}
      />
      <button type="button" className="task-main" onClick={() => onOpen(task)}>
        <span className="task-title">{task.topic}</span>
        <span className={`urgency-label urgency-${task.urgency}`}>
          <span className="urgency" aria-hidden="true" />
          {URGENCY_LABELS[task.urgency]}
        </span>
        <span className="task-sub">
          <span>{ownerLabel(partners, task.ownerIds)}</span>
          {done && category && <span>{category}</span>}
          {task.updates.length > 0 && <span>{task.updates.length} עדכונים</span>}
        </span>
      </button>
    </li>
  )
}

function TaskDialog({
  form,
  updates,
  setForm,
  onClose,
  onSave,
  onDelete,
  onAddUpdate,
  onDeleteUpdate,
}: {
  form: TaskForm
  updates: Task['updates']
  setForm: (form: TaskForm) => void
  onClose: () => void
  onSave: (input: TaskDraft) => Promise<void>
  onDelete: () => void
  onAddUpdate: (input: { taskId: string; body: string; partnerId: string | null }) => Promise<void>
  onDeleteUpdate: (taskId: string, updateId: string) => Promise<void>
}) {
  const partners = useAppStore(state => state.data.partners)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [updateBody, setUpdateBody] = useState('')
  const [updatePartner, setUpdatePartner] = useState('')

  function toggleOwner(id: string) {
    const ownerIds = form.ownerIds.includes(id)
      ? form.ownerIds.filter(ownerId => ownerId !== id)
      : [...form.ownerIds, id]
    setForm({ ...form, ownerIds })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.topic.trim()) { setError('יש להזין נושא'); return }
    if (!form.categoryId) { setError('יש לבחור קטגוריה'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: form.id,
        topic: form.topic,
        description: form.description,
        categoryId: form.categoryId,
        ownerIds: form.ownerIds,
        urgency: form.urgency,
        status: form.status,
      })
      if (form.id && updateBody.trim()) {
        await onAddUpdate({ taskId: form.id, body: updateBody, partnerId: updatePartner || null })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={form.id ? 'משימה' : 'משימה חדשה'} onClose={onClose}>
      <form id="task-form" onSubmit={event => void submit(event)}>
        {error && <p className="error">{error}</p>}
        <CategoryField value={form.categoryId} onChange={categoryId => setForm({ ...form, categoryId })} />
        <div className="field">
          <span>אחראים</span>
          <div className="chips">
            {partners.map(partner => (
              <button
                key={partner.id}
                type="button"
                className={form.ownerIds.includes(partner.id) ? 'chip chip-on' : 'chip'}
                aria-pressed={form.ownerIds.includes(partner.id)}
                onClick={() => toggleOwner(partner.id)}
              >
                {partner.name}
              </button>
            ))}
          </div>
        </div>
        <Field label="נושא">
          <input value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })} />
        </Field>
        <Field label="תיאור">
          <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={3} />
        </Field>
        <Field label="דחיפות">
          <Select
            value={form.urgency}
            onChange={urgency => setForm({ ...form, urgency: urgency as Urgency })}
            options={(Object.keys(URGENCY_LABELS) as Urgency[]).map(urgency => ({
              value: urgency,
              label: URGENCY_LABELS[urgency],
            }))}
          />
        </Field>
      </form>

      {form.id && (
        <section>
          <h3>עדכונים</h3>
          <ul className="update-list">
            {updates.map(update => (
              <li key={update.id} className="update">
                <p>{update.body}</p>
                <div className="row-actions">
                  <span className="muted">
                    {formatWhen(update.createdAt)}
                    {update.partnerId ? ` · ${partnerName(partners, update.partnerId)}` : ''}
                  </span>
                  <button type="button" className="btn btn-ghost" onClick={() => void onDeleteUpdate(form.id!, update.id)}>מחיקה</button>
                </div>
              </li>
            ))}
          </ul>
          <Field label="עדכון חדש">
            <textarea value={updateBody} onChange={event => setUpdateBody(event.target.value)} rows={2} />
          </Field>
          <Field label="מי כותב">
            <Select
              value={updatePartner}
              onChange={setUpdatePartner}
              options={[
                { value: '', label: 'בלי שם' },
                ...partners.map(partner => ({ value: partner.id, label: partner.name })),
              ]}
            />
          </Field>
        </section>
      )}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" form="task-form" disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>
        <button className="btn btn-ghost" type="button" onClick={onClose}>ביטול</button>
        {form.id && <button className="btn btn-danger" type="button" onClick={onDelete}>מחיקה</button>}
      </div>
    </Modal>
  )
}

