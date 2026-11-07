import { describe, expect, it } from 'vitest'
import { buildSeed, PARTNERS } from '../data/seed'
import { parseTaskCell } from './parseTaskCell'

describe('parseTaskCell', () => {
  it('assigns a single partner and keeps the topic', () => {
    expect(parseTaskCell('זכרון דברים - עסק (נועם)', PARTNERS)).toEqual({
      topic: 'זכרון דברים - עסק',
      ownerIds: ['p-noam'],
    })
  })

  it('assigns several partners separated by + with or without spaces', () => {
    expect(parseTaskCell('גיוס צוות (אריאל + נועם)', PARTNERS).ownerIds).toEqual(['p-ariel', 'p-noam'])
    expect(parseTaskCell('150,000 לחשבון הבנק (נועם+גלעד)', PARTNERS)).toEqual({
      topic: '150,000 לחשבון הבנק',
      ownerIds: ['p-noam', 'p-gilad'],
    })
  })

  it('assigns every partner when the cell says כולם', () => {
    expect(parseTaskCell('מעבר על חוזה קיים (כולם)', PARTNERS).ownerIds).toEqual([
      'p-gilad',
      'p-noam',
      'p-ariel',
    ])
  })

  it('leaves a parenthetical note in the topic when it is not a partner', () => {
    expect(parseTaskCell('מיתוג (לוגואים, שמות)', PARTNERS)).toEqual({
      topic: 'מיתוג (לוגואים, שמות)',
      ownerIds: [],
    })
  })

  it('does not treat a cell that is only a name in parentheses as an owner', () => {
    expect(parseTaskCell('(מאי)', PARTNERS)).toEqual({ topic: '(מאי)', ownerIds: [] })
  })
})

describe('buildSeed', () => {
  const seed = buildSeed([])

  it('imports the מטאפורה tab as open tasks with medium urgency', () => {
    expect(seed.tasks).toHaveLength(49)
    expect(seed.tasks.every(task => task.status === 'open' && task.urgency === 'medium')).toBe(true)
    expect(seed.expenses).toEqual([])
    expect(seed.contacts).toEqual([])
  })

  it('shares one category list, including the expense categories', () => {
    expect(seed.categories.map(category => category.name)).toEqual([
      'עסקה',
      'פתיחת חברה',
      'שותפות',
      'רישוי',
      'כוח אדם',
      'תחזוקה וציוד',
      'ספקים',
      'שוטף',
      'חוזה',
      'שיפוצים',
      'צוות',
    ])
  })

  it('keeps owner names out of the topic', () => {
    expect(seed.tasks.some(task => /\((גלעד|נועם|אריאל|כולם)/.test(task.topic))).toBe(false)
    expect(seed.tasks.find(task => task.topic === 'אתר לניהול עסק')?.ownerIds).toEqual(['p-gilad'])
    expect(seed.categories.some(category => category.name === 'צוות פוטנציאלי')).toBe(false)
    expect(seed.tasks.some(task => task.topic === 'ענבר' || task.topic === '(מאי)')).toBe(false)
  })
})
