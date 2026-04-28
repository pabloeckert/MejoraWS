'use client'

import { useAuth } from '@/lib/auth-context'
import { Sidebar } from '@/components/layout/sidebar'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth()
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login')
    }
  }, [token, isLoading, router])

  // Check onboarding status after mount
  useEffect(() => {
    if (token && typeof window !== 'undefined') {
      const done = localStorage.getItem('onboarding_completed')
      if (done !== 'true') {
        setShowOnboarding(true)
      }
    }
  }, [token])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!token) return null

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingComplete} />
      )}
    </div>
  )
}
