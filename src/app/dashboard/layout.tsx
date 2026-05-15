'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuth } from '@/components/providers/AuthProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [loading, session, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    )
  }

  if (!session) return null

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-8 text-center space-y-3">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-amber-100">
            <span className="text-xl font-bold text-amber-600">!</span>
          </div>
          <h2 className="text-base font-semibold text-slate-900">Profile Not Configured</h2>
          <p className="text-sm text-slate-600">
            Your account has no CRM profile. Contact your administrator to set up access.
          </p>
          <p className="text-xs text-slate-400">{session.user?.email}</p>
        </div>
      </div>
    )
  }

  if (profile.is_active === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="max-w-sm rounded-xl border border-red-200 bg-red-50 p-8 text-center space-y-3">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-red-100">
            <span className="text-xl font-bold text-red-600">✕</span>
          </div>
          <h2 className="text-base font-semibold text-slate-900">Account Inactive</h2>
          <p className="text-sm text-slate-600">
            Your account has been deactivated. Contact your administrator to restore access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  )
}
