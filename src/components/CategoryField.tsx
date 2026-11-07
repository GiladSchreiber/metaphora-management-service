import { useState } from 'react'
import { errorMessage } from '../lib/format'
import { useAppStore } from '../store/appStore'
import { PlusIcon } from './icons'
import { Select } from './Select'
import { Field } from './ui'

export function CategoryField({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const categories = useAppStore(state => state.data.categories)
  const saveCategory = useAppStore(state => state.saveCategory)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function add() {
    try {
      const id = await saveCategory({ name })
      onChange(id)
      setName('')
      setAdding(false)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div>
      {adding ? (
        <Field label="קטגוריה חדשה">
          <div className="inline-add">
            <input value={name} onChange={event => setName(event.target.value)} autoFocus />
            <button type="button" className="btn btn-primary" onClick={() => void add()}>הוספה</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setAdding(false); setError('') }}>ביטול</button>
          </div>
        </Field>
      ) : (
        <Field label="קטגוריה">
          <div className="inline-add">
            <Select
              value={value}
              onChange={onChange}
              options={
                categories.length === 0
                  ? [{ value: '', label: 'אין קטגוריות' }]
                  : categories.map(category => ({ value: category.id, label: category.name }))
              }
            />
            <button type="button" className="icon-btn" onClick={() => setAdding(true)} aria-label="הוסף קטגוריה"><PlusIcon /></button>
          </div>
        </Field>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
