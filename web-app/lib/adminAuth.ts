import { supabase } from './supabase'
import { UserProfile } from './supabase'

export async function checkAdminAccess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('admin_role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error checking admin access:', error)
      return false
    }

    return data?.admin_role === true
  } catch (error) {
    console.error('Error checking admin access:', error)
    return false
  }
}

export async function requireAdminAccess(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching admin profile:', error)
      return null
    }

    if (!data?.admin_role) {
      console.warn('User attempted to access admin area without admin role:', userId)
      return null
    }

    return data as UserProfile
  } catch (error) {
    console.error('Error requiring admin access:', error)
    return null
  }
}