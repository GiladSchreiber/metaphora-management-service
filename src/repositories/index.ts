import { getSupabase } from '../lib/supabase'
import { MockRepository } from './mock'
import { SupabaseRepository } from './supabaseRepo'
import type { Repository } from '../types'

export const repo: Repository = (() => {
  const supabase = getSupabase()
  return supabase ? new SupabaseRepository(supabase) : new MockRepository()
})()
