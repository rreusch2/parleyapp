import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './api/supabaseClient';
import { useRouter, useSegments } from 'expo-router';
import LoadingScreen from '../components/LoadingScreen';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        } else {
          console.log('📱 Initial session check:', session ? 'Found existing session' : 'No session found');
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session ? 'Has session' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (loading) return; // Don't navigate while loading

    const inAuthGroup = segments[0] === '(auth)';
    
    if (session && inAuthGroup) {
      // User is signed in but in auth screens, redirect to main app
      console.log('🏠 User authenticated, redirecting to main app');
      router.replace('/(tabs)');
    } else if (!session && !inAuthGroup) {
      // User is not signed in but in protected screens, redirect to login
      console.log('🔑 User not authenticated, redirecting to login');
      router.replace('/(auth)/login');
    }
  }, [session, segments, loading]);

  const signOut = async () => {
    try {
      console.log('👋 Signing out user...');
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signOut,
      }}
    >
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
}
