'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  GitBranch,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Activity,
} from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/contactos', label: 'Contactos', icon: Users },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/config', label: 'Config', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Activity className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">MejoraWS</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </aside>
  )
}
