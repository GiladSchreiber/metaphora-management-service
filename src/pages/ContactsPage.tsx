import { useMemo, useState, type FormEvent } from 'react'
import { EditIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons'
import { Field, Modal } from '../components/ui'
import { errorMessage } from '../lib/format'
import { useAppStore } from '../store/appStore'
import type { Contact, ContactDraft } from '../types'

const emptyForm = (): ContactDraft => ({
  name: '',
  phone: '',
  role: '',
  email: '',
  notes: '',
})

export function ContactsPage() {
  const contacts = useAppStore(state => state.data.contacts)
  const saveContact = useAppStore(state => state.saveContact)
  const deleteContact = useAppStore(state => state.deleteContact)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ContactDraft | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const visible = useMemo(() => {
    const text = query.trim()
    return [...contacts]
      .filter(contact => {
        if (!text) return true
        return [contact.name, contact.phone, contact.role, contact.email, contact.notes].some(value => value.includes(text))
      })
      .sort((a, b) => {
        const topic = contactColumns(a).topic.localeCompare(contactColumns(b).topic, 'he')
        return topic || a.name.localeCompare(b.name, 'he')
      })
  }, [contacts, query])

  function openExisting(contact: Contact) {
    setEditing({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      role: contact.role,
      email: contact.email,
      notes: contact.notes,
    })
    setError('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    if (!editing.name.trim()) { setError('יש להזין שם'); return }
    if (editing.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email.trim())) {
      setError('המייל לא נראה תקין')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveContact(editing)
      setEditing(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const pending = contacts.find(contact => contact.id === confirmId)

  return (
    <main className="page">
      <div className="page-head">
        <h2 className="page-title">אנשי קשר</h2>
        <div className="page-tools">
          <label className="icon-search">
            <span className="icon-search-hint" aria-hidden="true"><SearchIcon /></span>
            <input aria-label="חיפוש" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <button type="button" className="icon-btn" aria-label="איש קשר חדש" onClick={() => { setEditing(emptyForm()); setError('') }}>
            <PlusIcon />
          </button>
        </div>
      </div>

      {visible.length === 0 && <p className="empty">אין אנשי קשר להצגה.</p>}

      <ul className="list">
        {visible.map(contact => {
          const columns = contactColumns(contact)
          return (
            <li key={contact.id} className="contact-line">
              <div className="contact-main">
                <span className="contact-topic">{columns.topic}</span>
                <span className="contact-sub">
                  {columns.person && <span>{columns.person}</span>}
                  {contact.phone && <a className="ltr" href={`tel:${contact.phone}`}>{contact.phone}</a>}
                  {contact.email && <a className="ltr" href={`mailto:${contact.email}`}>{contact.email}</a>}
                  {columns.description && <span>{columns.description}</span>}
                </span>
              </div>
              <span className="contact-actions">
                <button type="button" className="icon-btn" aria-label="עריכה" onClick={() => openExisting(contact)}>
                  <EditIcon />
                </button>
                <button type="button" className="icon-btn" aria-label="מחיקה" onClick={() => setConfirmId(contact.id)}>
                  <TrashIcon />
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {editing && (
        <Modal title={editing.id ? 'עריכת איש קשר' : 'איש קשר חדש'} onClose={() => setEditing(null)}>
          <form onSubmit={event => void submit(event)}>
            {error && <p className="error">{error}</p>}
            <Field label="שם">
              <input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} />
            </Field>
            <Field label="טלפון">
              <input className="ltr" value={editing.phone} onChange={event => setEditing({ ...editing, phone: event.target.value })} inputMode="tel" />
            </Field>
            <Field label="תפקיד">
              <input value={editing.role} onChange={event => setEditing({ ...editing, role: event.target.value })} />
            </Field>
            <Field label="מייל">
              <input className="ltr" value={editing.email} onChange={event => setEditing({ ...editing, email: event.target.value })} inputMode="email" />
            </Field>
            <Field label="הערות">
              <textarea value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} rows={3} />
            </Field>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>ביטול</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmId && (
        <Modal title={pending ? `למחוק את ${contactColumns(pending).topic}?` : 'למחוק את איש הקשר?'} onClose={() => setConfirmId(null)}>
          <p>איש הקשר יימחק.</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void deleteContact(confirmId).then(() => {
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

function contactColumns(contact: Contact) {
  const name = contact.name.trim()
  const role = contact.role.trim()
  const notes = contact.notes.trim()
  if (notes) {
    const [company, ...rest] = notes.split(' · ')
    return {
      topic: company,
      person: name !== company ? name : '',
      description: [role, ...rest].filter(Boolean).join(' · '),
    }
  }
  if (role && role !== name) {
    return { topic: role, person: name, description: '' }
  }
  return { topic: name, person: '', description: role !== name ? role : '' }
}

