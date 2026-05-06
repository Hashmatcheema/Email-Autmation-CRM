'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'

export default function DashboardPage() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (profile?.role === 'admin') router.replace('/dashboard/admin')
    else if (profile?.role === 'sales') router.replace('/dashboard/sales')
  }, [profile, loading, router])

  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
    </div>
  )
}
