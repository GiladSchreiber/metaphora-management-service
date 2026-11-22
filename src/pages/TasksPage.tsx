import { useMemo, useState, type FormEvent } from 'react'
import { CategoryField } from '../components/CategoryField'
import { EditIcon, PlusIcon, SearchIcon } from '../components/icons'
import { Select } from '../components/Select'
import { Field, Modal } from '../components/ui'
import { errorMessage, formatWhen, newId } from '../lib/format'
import { ownerLabel, partnerName, URGENCY_LABELS } from '../lib/labels'
import { useAppStore } from '../store/appStore'
import type { Task, TaskDraft, TaskDetailsMode, TaskStatus, Subtask, Urgency } from '../types'

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
  detailsMode: TaskDetailsMode
  subtasks: Subtask[]
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
      detailsMode: null,
      subtasks: [],
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
      detailsMode: task.detailsMode,
      subtasks: task.subtasks.map(item => ({ ...item })),
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
          liveTask={liveTask}
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
  const setSubtaskDone = useAppStore(state => state.setSubtaskDone)
  const category = categories.find(item => item.id === task.categoryId)?.name
  const done = task.status === 'done'
  return (
    <li className={done ? 'task-row task-done' : 'task-row'}>
      <div className="task-heading">
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
            {task.subtasks.length > 0 && <span>{task.subtasks.filter(item => item.done).length}/{task.subtasks.length} תתי משימות</span>}
            {task.updates.length > 0 && <span>{task.updates.length} עדכונים</span>}
          </span>
        </button>
      </div>
      {task.subtasks.length > 0 && (
        <ul className="subtask-list">
          {task.subtasks.map(subtask => (
            <li key={subtask.id}>
              <label className={subtask.done ? 'subtask-item subtask-done' : 'subtask-item'}>
                <input type="checkbox" className="check" checked={subtask.done}
                  onChange={event => void setSubtaskDone(task.id, subtask.id, event.target.checked)} />
                <span>{subtask.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function TaskDialog({
  form,
  liveTask,
  updates,
  setForm,
  onClose,
  onSave,
  onDelete,
  onAddUpdate,
  onDeleteUpdate,
}: {
  form: TaskForm
  liveTask?: Task
  updates: Task['updates']
  setForm: (form: TaskForm) => void
  onClose: () => void
  onSave: (input: TaskDraft) => Promise<string>
  onDelete: () => void
  onAddUpdate: (input: { taskId: string; body: string; partnerId: string | null }) => Promise<void>
  onDeleteUpdate: (taskId: string, updateId: string) => Promise<void>
}) {
  const partners = useAppStore(state => state.data.partners)
  const categories = useAppStore(state => state.data.categories)
  const setTaskStatus = useAppStore(state => state.setTaskStatus)
  const setSubtaskDone = useAppStore(state => state.setSubtaskDone)
  const saveError = useAppStore(state => state.error)
  const [editMode, setEditMode] = useState(!form.id)
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
    if (saving) return
    if (!form.topic.trim()) { setError('יש להזין נושא'); return }
    if (form.detailsMode === 'checklist' && form.subtasks.some(item => !item.title.trim())) { setError('יש להזין טקסט לכל תת משימה או למחוק שורות ריקות'); return }
    if (!form.categoryId) { setError('יש לבחור קטגוריה'); return }
    setSaving(true)
    setError('')
    const isNew = !form.id
    try {
      const savedId = await onSave({
        id: form.id,
        topic: form.topic,
        description: form.description,
        categoryId: form.categoryId,
        ownerIds: form.ownerIds,
        urgency: form.urgency,
        status: form.status,
        detailsMode: form.detailsMode,
        subtasks: form.subtasks,
      })
      // Retain the new task id if posting its first update fails, so retrying does not create a duplicate.
      if (isNew) setForm({ ...form, id: savedId })
      if (form.detailsMode === 'updates' && updateBody.trim()) {
        await onAddUpdate({ taskId: savedId, body: updateBody, partnerId: updatePartner || null })
      }
      if (!isNew) {
        setSaving(false)
        setEditMode(false)
        setUpdateBody('')
      } else {
        onClose()
      }
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  async function postUpdate(event: FormEvent) {
    event.preventDefault()
    if (!liveTask || saving || !updateBody.trim()) return
    setSaving(true)
    setError('')
    try {
      await onAddUpdate({ taskId: liveTask.id, body: updateBody, partnerId: updatePartner || null })
      setUpdateBody('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const updateFields = (
    <>
      <Field label="עדכון חדש">
        <textarea value={updateBody} disabled={saving} onChange={event => setUpdateBody(event.target.value)} rows={2} />
      </Field>
      <Field label="מי כותב">
        <Select value={updatePartner} onChange={setUpdatePartner} options={[
          { value: '', label: 'בלי שם' },
          ...partners.map(partner => ({ value: partner.id, label: partner.name })),
        ]} />
      </Field>
    </>
  )

  const updateHistory = (
    <ul className="update-list">
      {updates.map(update => (
        <li key={update.id} className="update">
          <p>{update.body}</p>
          <div className="row-actions">
            <span className="muted">{formatWhen(update.createdAt)}{update.partnerId ? ` · ${partnerName(partners, update.partnerId)}` : ''}</span>
            {editMode && <button type="button" className="btn btn-ghost" disabled={saving} onClick={async () => {
              setError('')
              try { await onDeleteUpdate(form.id!, update.id) }
              catch (err) { setError(errorMessage(err)) }
            }}>מחיקה</button>}
          </div>
        </li>
      ))}
    </ul>
  )

  if (!editMode && liveTask) {
    return (
      <Modal title="משימה" onClose={onClose} actions={
        <button type="button" className="icon-btn" disabled={saving} aria-label="עריכת משימה" title="עריכת משימה"
          onClick={() => {
            setForm({ ...liveTask, subtasks: liveTask.subtasks.map(item => ({ ...item })) })
            setError('')
            setEditMode(true)
          }}><EditIcon /></button>
      }>
        {(error || saveError) && <p className="error" role="alert">{error || saveError}</p>}
        <div className="task-read-heading">
          <label className="subtask-item">
            <input type="checkbox" className="check" checked={liveTask.status === 'done'}
              aria-label={liveTask.status === 'done' ? 'החזרה לפתוחות' : 'סימון כבוצע'}
              onChange={event => void setTaskStatus(liveTask.id, event.target.checked ? 'done' : 'open')} />
            <span className={liveTask.status === 'done' ? 'task-read-title task-read-done' : 'task-read-title'}>{liveTask.topic}</span>
          </label>
        </div>
        <dl className="task-details">
          <div><dt>קטגוריה</dt><dd>{categories.find(category => category.id === liveTask.categoryId)?.name}</dd></div>
          <div><dt>אחראים</dt><dd>{ownerLabel(partners, liveTask.ownerIds)}</dd></div>
          <div><dt>דחיפות</dt><dd>{URGENCY_LABELS[liveTask.urgency]}</dd></div>
        </dl>
        {liveTask.description && <p className="task-description">{liveTask.description}</p>}
        {liveTask.detailsMode === 'checklist' && (
          <section>
            <h3>תתי משימות <span className="muted">({liveTask.subtasks.filter(item => item.done).length}/{liveTask.subtasks.length})</span></h3>
            <ul className="subtask-list">
              {liveTask.subtasks.map(subtask => (
                <li key={subtask.id}>
                  <label className={subtask.done ? 'subtask-item subtask-done' : 'subtask-item'}>
                    <input type="checkbox" className="check" checked={subtask.done}
                      onChange={event => void setSubtaskDone(liveTask.id, subtask.id, event.target.checked)} />
                    <span>{subtask.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
        {liveTask.detailsMode === 'updates' && (
          <section>
            <h3>עדכונים</h3>
            {updateHistory}
            <form onSubmit={event => void postUpdate(event)}>
              {updateFields}
              <button type="submit" className="btn btn-primary" disabled={saving || !updateBody.trim()}>
                {saving ? 'שומר…' : 'הוספת עדכון'}
              </button>
            </form>
          </section>
        )}
        {liveTask.detailsMode === 'checklist' && updates.length > 0 && (
          <details className="legacy-updates">
            <summary>עדכונים קודמים ({updates.length})</summary>
            {updateHistory}
          </details>
        )}
      </Modal>
    )
  }

  return (
    <Modal title={form.id ? 'עריכת משימה' : 'משימה חדשה'} onClose={onClose}>
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
        {form.detailsMode === null && (
          <div className="task-detail-options">
            <button type="button" className="btn btn-ghost" onClick={() => setForm({
              ...form, detailsMode: 'checklist', subtasks: [{ id: newId('subtask'), title: '', done: false }],
            })}>+ הוספת רשימה</button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, detailsMode: 'updates' })}>+ הוספת עדכון</button>
          </div>
        )}
        {form.detailsMode === 'checklist' && (
          <fieldset className="subtask-editor" disabled={saving}>
            <legend>תתי משימות</legend>
            <ul className="subtask-list">
              {form.subtasks.map((subtask, index) => (
                <li key={subtask.id} className="subtask-edit-row">
                  <input type="checkbox" className="check" checked={subtask.done}
                    aria-label={`סימון תת משימה ${index + 1} כבוצעה`}
                    onChange={event => setForm({ ...form, subtasks: form.subtasks.map(item => item.id === subtask.id ? { ...item, done: event.target.checked } : item) })} />
                  <input value={subtask.title} aria-label={`תת משימה ${index + 1}`} placeholder="מה צריך לעשות?"
                    onChange={event => setForm({ ...form, subtasks: form.subtasks.map(item => item.id === subtask.id ? { ...item, title: event.target.value } : item) })} />
                  <button type="button" className="btn btn-ghost" aria-label={`מחיקת תת משימה ${index + 1}`}
                    onClick={() => setForm({ ...form, subtasks: form.subtasks.filter(item => item.id !== subtask.id) })}>מחיקה</button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-ghost"
              onClick={() => setForm({ ...form, subtasks: [...form.subtasks, { id: newId('subtask'), title: '', done: false }] })}>
              + הוספת תת משימה
            </button>
            <p className="muted">השינויים ברשימה יישמרו בלחיצה על שמירה.</p>
          </fieldset>
        )}
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

      {form.detailsMode === 'updates' && (
        <section>
          <h3>עדכונים</h3>
          {updateHistory}
          {updateFields}
        </section>
      )}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" form="task-form" disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>
        <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => {
          if (form.id) {
            setEditMode(false)
            setError('')
            setUpdateBody('')
          } else onClose()
        }}>ביטול</button>
        {form.id && <button className="btn btn-danger" type="button" onClick={onDelete}>מחיקה</button>}
      </div>
    </Modal>
  )
}

