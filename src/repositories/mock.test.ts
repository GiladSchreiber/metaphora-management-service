import { beforeEach, expect, it, vi } from 'vitest'
import { buildSeed } from '../data/seed'
import { MockRepository } from './mock'

vi.mock('../data/loadContacts', () => ({ loadContactSeeds: () => [] }))

let saved: string | null
beforeEach(() => {
  saved = null
  vi.stubGlobal('localStorage', {
    getItem: () => saved,
    setItem: (_key: string, value: string) => { saved = value },
  })
})

it('loads older stored tasks with empty checklists without losing their data', async () => {
  const old = buildSeed([])
  saved = JSON.stringify(old, (key, value) => key === 'subtasks' ? undefined : value)
  const data = await new MockRepository().load()
  expect(data.tasks[0].subtasks).toEqual([])
  expect(data.tasks[0].topic).toBe(old.tasks[0].topic)
})

it('persists added, edited, checked and removed subtasks across reloads', async () => {
  const repo = new MockRepository()
  const original = (await repo.load()).tasks[0]
  await repo.saveTask({ ...original, subtasks: [
    { id: 'a', title: ' First ', done: false },
    { id: 'b', title: 'Second', done: false },
  ] })
  await repo.setSubtaskDone(original.id, 'a', true)
  let task = (await repo.load()).tasks.find(item => item.id === original.id)!
  expect(task.subtasks[0]).toEqual({ id: 'a', title: 'First', done: true })
  await repo.saveTask({ ...task, subtasks: [{ ...task.subtasks[0], title: 'Renamed' }] })
  task = (await new MockRepository().load()).tasks.find(item => item.id === original.id)!
  expect(task.subtasks).toEqual([{ id: 'a', title: 'Renamed', done: true }])
  expect(task.status).toBe('open')
})

it('remembers the chosen section independently of its contents', async () => {
  const repo = new MockRepository()
  const original = (await repo.load()).tasks[0]
  await repo.saveTask({ ...original, detailsMode: 'checklist', subtasks: [] })
  expect((await new MockRepository().load()).tasks.find(task => task.id === original.id)?.detailsMode).toBe('checklist')

  const newId = await repo.saveTask({ ...original, id: undefined, detailsMode: 'updates' })
  await repo.addTaskUpdate({ taskId: newId, body: 'First update', partnerId: null })
  let created = (await repo.load()).tasks.find(task => task.id === newId)!
  expect(created.detailsMode).toBe('updates')
  expect(created.updates[0].body).toBe('First update')
  await repo.deleteTaskUpdate(newId, created.updates[0].id)
  created = (await new MockRepository().load()).tasks.find(task => task.id === newId)!
  expect(created.detailsMode).toBe('updates')
  expect(created.updates).toEqual([])
})

it('infers legacy choices without dropping older content', async () => {
  const legacy = buildSeed([])
  legacy.tasks[0].subtasks = [{ id: 'a', title: 'First', done: false }]
  legacy.tasks[0].updates = [{ id: 'u', body: 'Existing update', partnerId: null, createdAt: legacy.tasks[0].createdAt }]
  saved = JSON.stringify(legacy, (key, value) => key === 'detailsMode' ? undefined : value)
  const task = (await new MockRepository().load()).tasks[0]
  expect(task.detailsMode).toBe('checklist')
  expect(task.subtasks).toHaveLength(1)
  expect(task.updates[0].body).toBe('Existing update')
})

it('attaches, reparents, and detaches full tasks while preserving their contents', async () => {
  const repo = new MockRepository()
  const [parent, child, other] = (await repo.load()).tasks
  await repo.addTaskUpdate({ taskId: child.id, body: 'Keep this update', partnerId: null })
  const before = (await repo.load()).tasks.find(task => task.id === child.id)!
  await repo.saveTask({ ...before, parentTaskId: parent.id })
  let attached = (await new MockRepository().load()).tasks.find(task => task.id === child.id)!
  expect(attached).toEqual({ ...before, parentTaskId: parent.id })
  await repo.saveTask({ ...attached, parentTaskId: other.id })
  attached = (await repo.load()).tasks.find(task => task.id === child.id)!
  expect(attached.parentTaskId).toBe(other.id)
  await repo.saveTask({ ...attached, parentTaskId: null })
  expect((await repo.load()).tasks.find(task => task.id === child.id)).toEqual(before)
})

it('rejects circular task attachments without changing saved tasks', async () => {
  const repo = new MockRepository()
  const [parent, child, grandchild] = (await repo.load()).tasks
  await repo.saveTask({ ...child, parentTaskId: parent.id })
  await repo.saveTask({ ...grandchild, parentTaskId: child.id })
  await expect(repo.saveTask({ ...parent, parentTaskId: grandchild.id })).rejects.toThrow()
  await expect(repo.saveTask({ ...parent, parentTaskId: parent.id })).rejects.toThrow()
  await expect(repo.saveTask({ ...parent, parentTaskId: 'missing' })).rejects.toThrow()
  expect((await repo.load()).tasks.find(task => task.id === parent.id)?.parentTaskId).toBeNull()
})

it('deleting a parent detaches its children without deleting their data or descendants', async () => {
  const repo = new MockRepository()
  const [parent, child, grandchild] = (await repo.load()).tasks
  await repo.saveTask({ ...child, parentTaskId: parent.id })
  await repo.saveTask({ ...grandchild, parentTaskId: child.id })
  await repo.addTaskUpdate({ taskId: child.id, body: 'Keep me', partnerId: null })
  await repo.deleteTask(parent.id)
  const data = await new MockRepository().load()
  expect(data.tasks.find(task => task.id === parent.id)).toBeUndefined()
  expect(data.tasks.find(task => task.id === child.id)?.parentTaskId).toBeNull()
  expect(data.tasks.find(task => task.id === child.id)?.updates[0].body).toBe('Keep me')
  expect(data.tasks.find(task => task.id === grandchild.id)?.parentTaskId).toBe(child.id)
})

it('tracks parent and child completion independently', async () => {
  const repo = new MockRepository()
  const [parent, child] = (await repo.load()).tasks
  await repo.saveTask({ ...child, parentTaskId: parent.id })
  await repo.setTaskStatus(child.id, 'done')
  let data = await repo.load()
  expect(data.tasks.find(task => task.id === parent.id)?.status).toBe('open')
  await repo.setTaskStatus(parent.id, 'done')
  await repo.setTaskStatus(child.id, 'open')
  data = await repo.load()
  expect(data.tasks.find(task => task.id === parent.id)?.status).toBe('done')
  expect(data.tasks.find(task => task.id === child.id)?.status).toBe('open')
})

it('loads old contacts with empty supplier fields without changing their original information', async () => {
  const seed = buildSeed([{ name: 'Supplier', phone: '0501234567', email: '', role: 'Delivery', notes: 'Original notes' }])
  const oldContact = seed.contacts[0]
  saved = JSON.stringify({ ...seed, contacts: [{
    id: oldContact.id, name: oldContact.name, phone: oldContact.phone, email: oldContact.email,
    role: oldContact.role, notes: oldContact.notes, createdAt: oldContact.createdAt,
  }] })
  const contact = (await new MockRepository().load()).contacts[0]
  expect(contact).toEqual(oldContact)
})

it('saves, reloads, partially edits, and clears supplier contact details', async () => {
  const repo = new MockRepository()
  await repo.saveContact({
    name: 'Supplier', phone: '0501234567', email: '', role: '', notes: '',
    supplierCategories: ['food', 'coffee_tea'], deliveryDays: [0, 3], orderingMethods: ['app', 'website', 'whatsapp'],
    appUrl: 'https://app.example/order', websiteUrl: 'supplier.example', whatsappNumber: '+972 50 123 4567',
    customerNumber: '00123', accountUsername: 'supplier-user', passwordManagerUrl: 'https://vault.example/item/123',
  })
  let contact = (await new MockRepository().load()).contacts[0]
  expect(contact).toMatchObject({
    supplierCategories: ['food', 'coffee_tea'], deliveryDays: [0, 3], orderingMethods: ['app', 'website', 'whatsapp'],
    websiteUrl: 'https://supplier.example/', customerNumber: '00123', accountUsername: 'supplier-user',
    passwordManagerUrl: 'https://vault.example/item/123',
  })
  await repo.saveContact({ id: contact.id, name: 'Renamed', phone: contact.phone, email: '', role: '', notes: '' })
  expect((await repo.load()).contacts[0]).toEqual({ ...contact, name: 'Renamed' })
  contact = (await repo.load()).contacts[0]
  await repo.saveContact({
    ...contact, supplierCategories: [], deliveryDays: [], orderingMethods: [], appUrl: '', websiteUrl: '',
    whatsappNumber: '', customerNumber: '', accountUsername: '', passwordManagerUrl: '',
  })
  expect((await new MockRepository().load()).contacts[0]).toMatchObject({
    supplierCategories: [], deliveryDays: [], orderingMethods: [], customerNumber: '', accountUsername: '', passwordManagerUrl: '',
  })
})

it('rejects unsafe supplier links without writing a contact', async () => {
  const repo = new MockRepository()
  await expect(repo.saveContact({
    name: 'Supplier', phone: '', email: '', role: '', notes: '', passwordManagerUrl: 'javascript:alert(1)',
  })).rejects.toThrow()
  expect((await repo.load()).contacts).toEqual([])
})
