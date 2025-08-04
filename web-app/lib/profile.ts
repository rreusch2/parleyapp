import { supabase, UserProfile } from '@/lib/supabase'

// Fetch the user's profile from the database
export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data as UserProfile
  } catch (error) {
    console.error('Error fetching profile:', error)
    return null
  }
}
