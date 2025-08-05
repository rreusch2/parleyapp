'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface AuthState {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  initializing: boolean
  justSignedUp: boolean
}

interface AuthContextType extends AuthState {
  clearJustSignedUp: () => void
  signUp: (email: string, password: string, username: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: false, // For specific actions like signIn/signUp
    initializing: true, // For initial auth state resolution
    justSignedUp: false,
  })
  const router = useRouter()

  useEffect(() => {
    const fetchUserProfile = async (user: User): Promise<UserProfile | null> => {
      console.log('📁 Fetching profile for user:', user.id)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('❌ Error fetching profile:', error)
          // It's possible the profile isn't created yet on first auth event
          if (error.code === 'PGRST116') { // "Not a single row was returned"
             return null
          }
          throw error
        }
        console.log('✅ Profile fetched successfully:', data.username)
        return data
      } catch (error) {
        console.error('An unexpected error occurred while fetching the profile:', error)
        return null
      }
    }

    // Set initial auth state
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let userProfile = null
      if (session?.user) {
        userProfile = await fetchUserProfile(session.user)
      }
      setAuthState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        profile: userProfile,
        initializing: false,
      }))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', { event, hasSession: !!session })
        
        let userProfile = null;
        if (session?.user) {
          userProfile = await fetchUserProfile(session.user)
        }

        setAuthState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          profile: userProfile,
          // Only stop initializing once we have a definitive auth state
          initializing: false, 
          // Stop loading for any action that triggered this
          loading: false 
        }))

        if (event === 'SIGNED_OUT') {
           // Redirect to home page on sign out for a clean user experience
           router.push('/')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const setLoading = (loading: boolean) => {
    setAuthState(prev => ({ ...prev, loading }))
  }

  const setJustSignedUp = (justSignedUp: boolean) => {
    setAuthState(prev => ({ ...prev, justSignedUp }))
  }

  const clearJustSignedUp = () => {
    console.log('🗑️ Clearing justSignedUp flag')
    setJustSignedUp(false)
  }

  const signUp = async (email: string, password: string, username: string) => {
    try {
      setLoading(true)
      console.log('📈 Starting signup process for:', email)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      })

      if (error) {
        console.error('❌ Supabase Auth signup error:', error)
        throw error
      }
      
      if (data.user) {
         // The onAuthStateChange listener will handle setting user and profile
        console.log('✅ Account created! User ID:', data.user.id)
        
        // This upsert is still useful for immediate profile creation
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
              id: data.user.id,
              username,
              email,
              subscription_tier: 'free',
              is_active: true,
              welcome_bonus_claimed: false,
              admin_role: false,
              subscription_status: 'inactive',
              notification_settings: { ai_picks: true }
          }, { onConflict: 'id' });

        if (profileError) {
          console.error('❌ Error creating/updating profile on signup:', profileError)
          toast.error('Could not create your user profile. Please contact support.')
        } else {
            console.log('✅ Profile created/updated successfully on signup')
        }

        console.log('🚀 Setting justSignedUp flag to trigger onboarding')
        setJustSignedUp(true)
        
        if (data.user.identities?.length === 0) { // User needs to verify email
           toast.success('Please check your email to confirm your account!')
        } else {
           toast.success('Account created successfully!')
        }
      } else {
        // Handle cases where sign up doesn't return a user (e.g. email verification required)
        toast.success('Confirmation email sent! Please check your inbox.')
      }
    } catch (error: any) {
      console.error('Sign up error:', error)
      toast.error(error.message || 'Failed to sign up')
      throw error // Re-throw to be caught by the calling component
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast.success('Welcome back!')
      // onAuthStateChange will handle the rest
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
      // onAuthStateChange will handle the rest
    } catch (error: any) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!authState.user) throw new Error('No user logged in')
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', authState.user.id)
        .select()
        .single()

      if (error) throw error

      setAuthState(prev => ({ ...prev, profile: data as UserProfile }))
      toast.success('Profile updated successfully')
    } catch (error: any) {
      console.error('Update profile error:', error)
      toast.error('Failed to update profile')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (!authState.user) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authState.user.id)
        .single()
      if (error) throw error
      setAuthState(prev => ({...prev, profile: data as UserProfile}))
    } catch (error) {
      console.error('Error refreshing profile:', error)
    }
  }
  
  const value: AuthContextType = {
    ...authState,
    clearJustSignedUp,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
