import type { ContactSupplierDetails } from '../types'

export const CONTACT_CATEGORIES = [
  { value: 'food', label: 'אוכל' },
  { value: 'alcohol', label: 'אלכוהול' },
  { value: 'coffee_tea', label: 'קפה ותה' },
  { value: 'professionals', label: 'אנשי מקצוע' },
] as const

export const DELIVERY_DAYS = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
  { value: 6, label: 'שבת' },
] as const

export const ORDERING_METHODS = [
  { value: 'app', label: 'אפליקציה' },
  { value: 'website', label: 'אתר' },
  { value: 'whatsapp', label: 'וואטסאפ' },
] as const

export function contactDetails(input: Partial<ContactSupplierDetails> = {}): ContactSupplierDetails {
  return {
    supplierCategories: CONTACT_CATEGORIES.map(item => item.value).filter(value => input.supplierCategories?.includes(value)),
    deliveryDays: DELIVERY_DAYS.map(item => item.value).filter(value => input.deliveryDays?.includes(value)),
    orderingMethods: ORDERING_METHODS.map(item => item.value).filter(value => input.orderingMethods?.includes(value)),
    appUrl: input.appUrl ?? '',
    websiteUrl: input.websiteUrl ?? '',
    whatsappNumber: input.whatsappNumber ?? '',
    customerNumber: input.customerNumber ?? '',
    accountUsername: input.accountUsername ?? '',
    passwordManagerUrl: input.passwordManagerUrl ?? '',
  }
}

// Only web links are rendered as anchors; credentials stay in the password manager.
export function contactWebUrl(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return null
    return url.href
  } catch {
    return null
  }
}

export function whatsappUrl(value: string): string | null {
  if (!/^[+\d\s()-]+$/.test(value)) return null
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = `972${digits.slice(1)}`
  return /^[1-9]\d{6,14}$/.test(digits) ? `https://wa.me/${digits}` : null
}

export function prepareContactDetails(input: Partial<ContactSupplierDetails>): ContactSupplierDetails {
  const details = contactDetails(input)
  for (const field of ['appUrl', 'websiteUrl', 'passwordManagerUrl'] as const) {
    const value = details[field].trim()
    const url = contactWebUrl(value)
    if (value && !url) throw new Error('יש להזין קישור תקין שמתחיל ב־https:// או http://')
    details[field] = url ?? ''
  }
  details.whatsappNumber = details.whatsappNumber.trim()
  if (details.whatsappNumber && !whatsappUrl(details.whatsappNumber)) throw new Error('יש להזין מספר וואטסאפ תקין')
  details.customerNumber = details.customerNumber.trim()
  details.accountUsername = details.accountUsername.trim()
  return details
}
