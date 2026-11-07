import type { Partner, Urgency } from '../types'

export const URGENCY_LABELS: Record<Urgency, string> = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
}

export function partnerName(partners: Partner[], id: string | null | undefined): string {
  if (!id) return ''
  return partners.find(partner => partner.id === id)?.name ?? ''
}

export function ownerLabel(partners: Partner[], ownerIds: string[]): string {
  if (ownerIds.length === 0) return 'לא משויך'
  return ownerIds
    .map(id => partnerName(partners, id))
    .filter(Boolean)
    .join(', ')
}
