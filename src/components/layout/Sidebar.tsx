'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Mail, BarChart2,
  Activity, UserCog, UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'

const DASHBOARD_PATHS = ['/dashboard', '/dashboard/admin', '/dashboard/sales']

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  dashboardRoot?: boolean
}

export function Sidebar() {
  const pathname = usePathname()
  const { profile, isAdmin } = useAuth()

  const dashboardHref = profile?.role === 'sales' ? '/dashboard/sales' : '/dashboard/admin'

  const mainNav: NavItem[] = [
    { href: dashboardHref, label: isAdmin ? 'Dashboard' : 'My Dashboard', icon: LayoutDashboard, dashboardRoot: true },
    { href: '/dashboard/leads', label: 'Leads', icon: Users },
    ...(isAdmin ? [{ href: '/dashboard/activity', label: 'Sales Activity', icon: Activity }] : []),
  ]

  const toolsNav: NavItem[] = [
    { href: '/dashboard/templates', label: 'Email Templates', icon: Mail },
    { href: '/dashboard/reports', label: 'Reports', icon: BarChart2 },
  ]

  const adminNav: NavItem[] = isAdmin ? [
    { href: '/dashboard/admin/users', label: 'User Management', icon: UserCog },
    { href: '/dashboard/admin/assign-leads', label: 'Lead Assignment', icon: UserCheck },
  ] : []

  function isActive(item: NavItem) {
    if (item.dashboardRoot) return DASHBOARD_PATHS.includes(pathname)
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  function renderLink(item: NavItem) {
    const active = isActive(item)
    // Only suppress navigation when already on the exact destination — otherwise
    // sub-pages (e.g. /dashboard/leads/[lead_id]) can never click back up to the list.
    const exact = item.dashboardRoot
      ? DASHBOARD_PATHS.includes(pathname)
      : pathname === item.href
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={(e) => { if (exact) e.preventDefault() }}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          active
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    )
  }

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

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {mainNav.map(renderLink)}

        <div className="my-2 border-t border-slate-800" />

        {toolsNav.map(renderLink)}

        {adminNav.length > 0 && (
          <>
            <div className="my-2 border-t border-slate-800" />
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Admin
            </p>
            {adminNav.map(renderLink)}
          </>
        )}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
            {(profile?.name?.[0] ?? profile?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">
              {profile?.name ?? profile?.email}
            </p>
            <p className="text-[11px] capitalize text-slate-500">{profile?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
