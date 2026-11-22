import { useMemo, useState, type FormEvent } from 'react'
import { EditIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons'
import { Select } from '../components/Select'
import { Field, Modal } from '../components/ui'
import { CONTACT_CATEGORIES, DELIVERY_DAYS, ORDERING_METHODS, contactDetails, contactWebUrl, whatsappUrl } from '../lib/contactDetails'
import { errorMessage } from '../lib/format'
import { useAppStore } from '../store/appStore'
import type { Contact, ContactDraft, ContactSupplierDetails } from '../types'

type ContactForm = ContactDraft & ContactSupplierDetails

const emptyForm = (): ContactForm => ({
  ...contactDetails(),
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
  const [categoryFilter, setCategoryFilter] = useState('')
  const [editing, setEditing] = useState<ContactForm | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase()
    return [...contacts]
      .filter(contact => {
        if (categoryFilter === 'none' && contact.supplierCategories.length > 0) return false
        if (categoryFilter && categoryFilter !== 'none' && !contact.supplierCategories.some(value => value === categoryFilter)) return false
        if (!text) return true
        return [
          contact.name, contact.phone, contact.role, contact.email, contact.notes,
          contact.customerNumber, contact.accountUsername,
          ...CONTACT_CATEGORIES.filter(item => contact.supplierCategories.includes(item.value)).map(item => item.label),
          ...DELIVERY_DAYS.filter(item => contact.deliveryDays.includes(item.value)).map(item => item.label),
          ...ORDERING_METHODS.filter(item => contact.orderingMethods.includes(item.value)).map(item => item.label),
        ].some(value => value.toLocaleLowerCase().includes(text))
      })
      .sort((a, b) => {
        const topic = contactColumns(a).topic.localeCompare(contactColumns(b).topic, 'he')
        return topic || a.name.localeCompare(b.name, 'he')
      })
  }, [contacts, query, categoryFilter])

  function openExisting(contact: Contact) {
    setEditing({
      ...contactDetails(contact),
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
    if (!editing || saving) return
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

      <div className="toolbar">
        <Select ariaLabel="סינון לפי קטגוריה" value={categoryFilter} onChange={setCategoryFilter} options={[
          { value: '', label: 'כל הקטגוריות' },
          { value: 'none', label: 'ללא קטגוריה' },
          ...CONTACT_CATEGORIES,
        ]} />
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
                <ContactDetails contact={contact} />
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
            <ContactChoices label="קטגוריות" options={CONTACT_CATEGORIES} value={editing.supplierCategories}
              onChange={supplierCategories => setEditing({ ...editing, supplierCategories })} />
            <ContactChoices label="ימי אספקה" options={DELIVERY_DAYS} value={editing.deliveryDays}
              onChange={deliveryDays => setEditing({ ...editing, deliveryDays })} />
            <ContactChoices label="דרכי הזמנה" options={ORDERING_METHODS} value={editing.orderingMethods}
              onChange={orderingMethods => setEditing({ ...editing, orderingMethods })} />
            {editing.orderingMethods.includes('app') && (
              <Field label="קישור לאפליקציה">
                <input dir="ltr" inputMode="url" placeholder="https://" value={editing.appUrl}
                  onChange={event => setEditing({ ...editing, appUrl: event.target.value })} />
              </Field>
            )}
            {editing.orderingMethods.includes('website') && (
              <Field label="אתר להזמנות">
                <input dir="ltr" inputMode="url" placeholder="https://" value={editing.websiteUrl}
                  onChange={event => setEditing({ ...editing, websiteUrl: event.target.value })} />
              </Field>
            )}
            {editing.orderingMethods.includes('whatsapp') && (
              <Field label="מספר וואטסאפ להזמנות (אם שונה מהטלפון)">
                <input dir="ltr" inputMode="tel" placeholder={editing.phone} value={editing.whatsappNumber}
                  onChange={event => setEditing({ ...editing, whatsappNumber: event.target.value })} />
              </Field>
            )}
            <fieldset className="contact-account-editor">
              <legend>פרטי חשבון אצל הספק</legend>
              <Field label="מספר הלקוח שלנו">
                <input dir="ltr" value={editing.customerNumber}
                  onChange={event => setEditing({ ...editing, customerNumber: event.target.value })} />
              </Field>
              <Field label="שם משתמש באפליקציה / באתר">
                <input dir="ltr" autoComplete="off" value={editing.accountUsername}
                  onChange={event => setEditing({ ...editing, accountUsername: event.target.value })} />
              </Field>
              <Field label="קישור לפריט במנהל הסיסמאות">
                <input dir="ltr" inputMode="url" placeholder="https://" value={editing.passwordManagerUrl}
                  onChange={event => setEditing({ ...editing, passwordManagerUrl: event.target.value })} />
              </Field>
              <p className="muted">יש להשתמש בקישור שדורש כניסה למנהל הסיסמאות. הסיסמה נשארת שם.</p>
            </fieldset>
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


function ContactChoices<T extends string | number>({ label, options, value, onChange }: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T[]
  onChange: (value: T[]) => void
}) {
  return (
    <fieldset className="contact-choices">
      <legend>{label}</legend>
      <div className="chips">
        {options.map(option => (
          <button key={option.value} type="button" className={value.includes(option.value) ? 'chip chip-on' : 'chip'}
            aria-pressed={value.includes(option.value)}
            onClick={() => onChange(value.includes(option.value) ? value.filter(item => item !== option.value) : [...value, option.value])}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ContactDetails({ contact }: { contact: Contact }) {
  const accountLink = contactWebUrl(contact.passwordManagerUrl)
  const hasAccount = Boolean(contact.customerNumber || contact.accountUsername || accountLink)
  return (
    <>
      {contact.supplierCategories.length > 0 && (
        <div className="contact-category-tags">
          {CONTACT_CATEGORIES.filter(item => contact.supplierCategories.includes(item.value)).map(item => <span key={item.value}>{item.label}</span>)}
        </div>
      )}
      {contact.deliveryDays.length > 0 && (
        <span className="contact-supplier-info">ימי אספקה: {DELIVERY_DAYS.filter(item => contact.deliveryDays.includes(item.value)).map(item => item.label).join(', ')}</span>
      )}
      {contact.orderingMethods.length > 0 && (
        <div className="contact-ordering">
          <span>הזמנה:</span>
          {ORDERING_METHODS.filter(item => contact.orderingMethods.includes(item.value)).map(item => {
            const href = item.value === 'app' ? contactWebUrl(contact.appUrl)
              : item.value === 'website' ? contactWebUrl(contact.websiteUrl)
              : whatsappUrl(contact.whatsappNumber || contact.phone)
            return href ? <a key={item.value} href={href} target="_blank" rel="noopener noreferrer">{item.label}</a>
              : <span key={item.value}>{item.label}</span>
          })}
        </div>
      )}
      {hasAccount && (
        <details className="contact-account-details">
          <summary>פרטי חשבון</summary>
          <dl>
            {contact.customerNumber && <div><dt>מספר לקוח</dt><dd dir="auto">{contact.customerNumber}</dd></div>}
            {contact.accountUsername && <div><dt>שם משתמש</dt><dd dir="auto">{contact.accountUsername}</dd></div>}
          </dl>
          {accountLink && <a href={accountLink} target="_blank" rel="noopener noreferrer">פתיחה במנהל הסיסמאות</a>}
        </details>
      )}
    </>
  )
}
