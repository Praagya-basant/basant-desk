import { supabase } from '../supabase'

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('users').update({ is_active: isActive }).eq('id', userId)
  if (error) throw error
}
