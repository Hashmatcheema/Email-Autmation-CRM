'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LogOut, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/AuthProvider'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard/admin': 'Dashboard',
  '/dashboard/sales': 'Dashboard',
  '/dashboard/leads': 'Leads',
  '/dashboard/leads/new': 'Add Lead',
  '/dashboard/templates': 'Email Templates',
  '/dashboard/reports': 'Reports',
}

export function Header() {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const title =
    PAGE_TITLES[pathname] ??
    (pathname.endsWith('/edit') ? 'Edit Lead' : pathname.includes('/leads/') ? 'Lead Detail' : 'Dashboard')

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.[0] ?? '?').toUpperCase()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <span className="font-medium text-slate-900">{title}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'h-9 gap-2 px-2 text-slate-700 hover:text-slate-900'
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
            {initials}
          </div>
          <span className="hidden text-sm font-medium sm:block">
            {profile?.full_name ?? profile?.email?.split('@')[0]}
          </span>
          <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="pb-1">
            <p className="truncate text-sm font-medium">{profile?.full_name ?? profile?.email}</p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{profile?.role}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
