import type { Partner } from '../types'

export interface ParsedTaskCell {
  topic: string
  ownerIds: string[]
}

// Spreadsheet cells look like "נושא (נועם)" or "נושא (אריאל + נועם)".
// "כולם" means every current partner. A parenthesis that is not a partner
// name stays part of the topic, for example "מיתוג (לוגואים, שמות)".
// A cell that is only "(מאי)" has no topic in front, so it stays unassigned.
export function parseTaskCell(raw: string, partners: Pick<Partner, 'id' | 'name'>[]): ParsedTaskCell {
  const text = raw.trim()
  const match = text.match(/^(.*\S)\s*\(([^)]+)\)\s*$/)
  if (!match) return { topic: text, ownerIds: [] }

  const topic = match[1].trim()
  const inside = match[2].trim()
  if (inside === 'כולם') {
    return { topic, ownerIds: partners.map(partner => partner.id) }
  }

  const tokens = inside.split(/\s*(?:\+|\/|,|،)\s*/).map(token => token.trim()).filter(Boolean)
  const byName = new Map(partners.map(partner => [partner.name, partner.id]))
  const ownerIds: string[] = []
  for (const token of tokens) {
    const id = byName.get(token)
    if (!id) return { topic: text, ownerIds: [] }
    if (!ownerIds.includes(id)) ownerIds.push(id)
  }
  if (ownerIds.length === 0) return { topic: text, ownerIds: [] }
  return { topic, ownerIds }
}
