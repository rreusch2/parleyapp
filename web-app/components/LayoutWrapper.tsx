'use client'
import { usePathname } from 'next/navigation'
import { useAIChat } from '@/shared/hooks/useAIChat'
import Navigation from './Navigation'
import AIChatModal from './AIChatModal'

interface LayoutWrapperProps {
  children: React.ReactNode
}

// Routes that should NOT show navigation
const publicRoutes = ['/', '/privacy', '/terms']

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname()
  const { showAIChat, setShowAIChat } = useAIChat()
  
  const isPublicRoute = publicRoutes.includes(pathname)

  return (
    <>
      {!isPublicRoute && <Navigation />}
      <main className={isPublicRoute ? '' : 'min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900'}>
        {children}
      </main>
      {!isPublicRoute && (
        <AIChatModal 
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)}
        />
      )}
    </>
  )
}