'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, Permission } from '@/types'
import { hasPermission, hasAnyPermission, canAccessRoute } from '@/lib/permissions'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (user: User) => void
  logout: () => void
  can: (permission: Permission) => boolean
  canAny: (permissions: Permission[]) => boolean
  canAccessRoute: (route: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error('Session check failed:', error)
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [])

  const login = (userData: User) => {
    setUser(userData)
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    }
    setUser(null)
  }

  const can = (permission: Permission) => hasPermission(user, permission)
  const canAny = (permissions: Permission[]) => hasAnyPermission(user, permissions)
  const checkRoute = (route: string) => canAccessRoute(user, route)

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      can,
      canAny,
      canAccessRoute: checkRoute
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
