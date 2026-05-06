'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Mail, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/templates', label: 'Email Templates', icon: Mail },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-slate-900">
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500 shadow-sm">
          <span className="text-xs font-bold text-white">E</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">EITACIES</p>
          <p className="text-[11px] text-slate-400 leading-tight mt-0.5">CRM Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
            {(profile?.full_name?.[0] ?? profile?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">
              {profile?.full_name ?? profile?.email}
            </p>
            <p className="text-[11px] capitalize text-slate-500">{profile?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
