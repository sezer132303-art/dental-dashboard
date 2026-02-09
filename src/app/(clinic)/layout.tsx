'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  Users,
  LogOut,
  Menu,
  X,
  MessageCircle,
  CalendarDays,
  Settings,
  Stethoscope,
  Building2
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navigation = [
  { name: 'Табло', href: '/clinic', icon: LayoutDashboard },
  { name: 'Лекари', href: '/clinic/doctors', icon: Stethoscope },
  { name: 'Часове', href: '/clinic/appointments', icon: Calendar },
  { name: 'Пациенти', href: '/clinic/patients', icon: Users },
  { name: 'WhatsApp', href: '/clinic/conversations', icon: MessageCircle },
  { name: 'Календар', href: '/clinic/calendar', icon: CalendarDays },
  { name: 'Настройки', href: '/clinic/settings', icon: Settings },
]

interface ClinicUser {
  name: string
  clinicName: string
}

export default function ClinicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<ClinicUser | null>(null)

  useEffect(() => {
    // Fetch current user info
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser({
            name: data.user.name || 'Клиника',
            clinicName: data.clinicName || 'Моята клиника'
          })
        }
      })
      .catch(console.error)
  }, [])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b bg-gradient-to-r from-teal-600 to-cyan-600">
            <Link href="/clinic" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-white">Клиника Портал</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Clinic name badge */}
          <div className="px-4 py-3 bg-teal-50 border-b">
            <p className="text-xs text-teal-600 font-medium uppercase tracking-wider">
              Вашата клиника
            </p>
            <p className="text-sm font-semibold text-teal-900 truncate">
              {user?.clinicName || 'Зареждане...'}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/clinic' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-teal-100 text-teal-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <item.icon className={cn('w-5 h-5', isActive && 'text-teal-600')} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-teal-700">
                  {(user?.name || 'К').charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || 'Зареждане...'}
                </p>
                <p className="text-xs text-teal-600 font-medium">
                  Клиника портал
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title="Изход"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b h-16 flex items-center px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 mr-4"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {navigation.find(n => n.href === pathname)?.name || 'Табло'}
          </h1>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
