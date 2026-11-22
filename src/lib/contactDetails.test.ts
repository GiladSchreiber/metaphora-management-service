import { describe, expect, it } from 'vitest'
import { contactDetails, contactWebUrl, prepareContactDetails, whatsappUrl } from './contactDetails'

describe('supplier contact details', () => {
  it('keeps older contacts valid with empty defaults and independent arrays', () => {
    const first = contactDetails()
    first.deliveryDays.push(1)
    expect(contactDetails().deliveryDays).toEqual([])
    expect(contactDetails().supplierCategories).toEqual([])
    expect(contactDetails().passwordManagerUrl).toBe('')
  })

  it('normalizes duplicate choices in category, weekday and method order', () => {
    const details = contactDetails({
      supplierCategories: ['coffee_tea', 'food', 'food'], deliveryDays: [5, 1, 0, 1], orderingMethods: ['whatsapp', 'app', 'app'],
    })
    expect(details.supplierCategories).toEqual(['food', 'coffee_tea'])
    expect(details.deliveryDays).toEqual([0, 1, 5])
    expect(details.orderingMethods).toEqual(['app', 'whatsapp'])
  })

  it('accepts web links and rejects executable URLs and embedded credentials', () => {
    expect(contactWebUrl(' supplier.example/order ')).toBe('https://supplier.example/order')
    expect(contactWebUrl('https://vault.example/item/123')).toBe('https://vault.example/item/123')
    for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/item', 'https://user:secret@vault.example', 'not a url']) {
      expect(contactWebUrl(value)).toBeNull()
      expect(() => prepareContactDetails({ passwordManagerUrl: value })).toThrow()
    }
  })

  it('opens local and international WhatsApp numbers and rejects malformed input', () => {
    expect(whatsappUrl('050-123-4567')).toBe('https://wa.me/972501234567')
    expect(whatsappUrl('+44 (7700) 900123')).toBe('https://wa.me/447700900123')
    expect(whatsappUrl('0044 7700 900123')).toBe('https://wa.me/447700900123')
    expect(whatsappUrl('123')).toBeNull()
    expect(whatsappUrl('javascript:123456789')).toBeNull()
    expect(() => prepareContactDetails({ whatsappNumber: 'not a phone' })).toThrow()
  })

  it('preserves leading zeros in customer numbers', () => {
    expect(prepareContactDetails({ customerNumber: ' 001234 ', accountUsername: ' supplier-user ' })).toMatchObject({
      customerNumber: '001234', accountUsername: 'supplier-user',
    })
  })
})
