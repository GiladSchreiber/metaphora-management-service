import type { ContactSeed } from './seed'

export function loadContactSeeds(): ContactSeed[] {
  const modules = import.meta.glob('./contacts.local.ts', { eager: true }) as Record<
    string,
    { localContacts?: ContactSeed[] }
  >
  return Object.values(modules)[0]?.localContacts ?? []
}
