'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useAIChat } from '@/shared/hooks/useAIChat'
import Navigation from './Navigation'
import AIChatModal from './AIChatModal'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface LayoutWrapperProps {
  children: React.ReactNode
}

const publicRoutes = ['/', '/privacy', '/terms', '/signin', '/signup']
const authRoutes = ['/signin', '/signup']

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { showAIChat, setShowAIChat } = useAIChat()
  const { initializing, user } = useAuth()

  const isPublicRoute = publicRoutes.includes(pathname)
  const isAuthRoute = authRoutes.includes(pathname)

  useEffect(() => {
    if (initializing) {
      return // Don't do anything while we're still figuring out the auth state
    }

    if (!user && !isPublicRoute) {
      console.log('User not authenticated and on a protected route. Redirecting to home.')
      router.push('/')
    }

    if (user && isAuthRoute) {
      console.log('User is authenticated but on an auth route. Redirecting to dashboard.')
      router.push('/dashboard')
    }
  }, [initializing, user, isPublicRoute, isAuthRoute, router, pathname])

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
  }

  // Render the layout
  const showNav = user && !isPublicRoute

  return (
    <>
      {showNav && <Navigation />}
      <main className={!showNav ? 'h-full' : 'pt-16 sm:pt-20'}>
        {children}
      </main>
      {showNav && (
        <AIChatModal
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)}
        />
      )}
    </>
  )
}
