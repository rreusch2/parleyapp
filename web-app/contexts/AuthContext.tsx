'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  justSignedUp: boolean
  clearJustSignedUp: () => void
  signUp: (email: string, password: string, username: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [justSignedUp, setJustSignedUp] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      console.log('📁 Fetching profile for user:', userId)
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Error fetching profile:', error)
        return null
      }

      console.log('✅ Profile fetched successfully:', {
        username: data.username,
        sport_preferences: data.sport_preferences,
        betting_style: data.betting_style,
        welcome_bonus_claimed: data.welcome_bonus_claimed
      })

      return data as UserProfile
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }

  // Initialize auth state - wait for client-side hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Only initialize auth after client-side hydration
    if (!mounted) return

    console.log('🚀 Initializing auth after client hydration')
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Initial session check:', { hasSession: !!session, hasUser: !!session?.user })
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile)
      }
      
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id
      })
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const userProfile = await fetchProfile(session.user.id)
        setProfile(userProfile)
      } else {
        setProfile(null)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [mounted])

  const signUp = async (email: string, password: string, username: string) => {
    try {
      setLoading(true)
      
      console.log('📈 Starting signup process for:', email)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          }
        }
      })

      if (error) {
        console.error('❌ Supabase Auth signup error:', error)
        throw error
      }

      console.log('📊 Signup response:', {
        user: data.user ? 'User object received' : 'No user object',
        user_id: data.user?.id,
        session: data.session ? 'Session created' : 'No session',
        confirmation_sent_at: data.user?.confirmation_sent_at
      })

      if (data.user) {
                // Create or update profile record - handle duplicates gracefully
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert([
            {
              id: data.user.id,
              username,
              email,
              subscription_tier: 'free',
              is_active: true,
              welcome_bonus_claimed: false,
              admin_role: false,
              subscription_status: 'inactive',
              notification_settings: { ai_picks: true }
            }
          ], {
            onConflict: 'id',
            ignoreDuplicates: false
          })

        if (profileError) {
          console.error('❌ Error creating/updating profile:', profileError)
          // DON'T throw error - still trigger onboarding even if profile exists
          console.warn('⚠️ Profile creation failed but continuing with signup flow')
        } else {
          console.log('✅ Profile created/updated successfully')
        }

        console.log('✅ Account/Auth successful! User ID:', data.user.id)
        
        // ALWAYS set justSignedUp flag for ANY successful auth flow
        console.log('🚀 Setting justSignedUp flag to trigger onboarding')
        setJustSignedUp(true)
        
        // Show success message
        if (data.user.confirmation_sent_at) {
          toast.success('Please check your email to confirm your account!')
        } else {
          toast.success('Account created successfully!')
        }
      }
    } catch (error: any) {
      console.error('Sign up error:', error)
      toast.error(error.message || 'Failed to sign up')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        toast.success('Welcome back!')
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      toast.error(error.message || 'Failed to sign in')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      
      if (error) throw error
      
      toast.success('Signed out successfully')
    } catch (error: any) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in')

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data as UserProfile)
      toast.success('Profile updated successfully')
    } catch (error: any) {
      console.error('Update profile error:', error)
      toast.error('Failed to update profile')
      throw error
    }
  }

  const refreshProfile = async () => {
    if (!user) return

    try {
      const userProfile = await fetchProfile(user.id)
      setProfile(userProfile)
    } catch (error) {
      console.error('Error refreshing profile:', error)
    }
  }

  const clearJustSignedUp = () => {
    console.log('🗑️ Clearing justSignedUp flag')
    setJustSignedUp(false)
  }

  const value = {
    user,
    profile,
    session,
    loading,
    justSignedUp,
    clearJustSignedUp,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
