'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Permission } from '@/types'

interface PermissionGateProps {
  children: ReactNode
  permission?: Permission
  permissions?: Permission[]
  requireAll?: boolean
  fallback?: ReactNode
}

export function PermissionGate({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null
}: PermissionGateProps) {
  const { can, canAny, loading } = useAuth()

  if (loading) {
    return null
  }

  // Single permission check
  if (permission) {
    return can(permission) ? <>{children}</> : <>{fallback}</>
  }

  // Multiple permissions check
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      const hasAll = permissions.every(p => can(p))
      return hasAll ? <>{children}</> : <>{fallback}</>
    } else {
      return canAny(permissions) ? <>{children}</> : <>{fallback}</>
    }
  }

  // No permission specified, show children
  return <>{children}</>
}

// HOC for page-level permission protection
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission: Permission
) {
  return function ProtectedComponent(props: P) {
    const { can, loading } = useAuth()

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if (!can(requiredPermission)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Нямате достъп</h1>
            <p className="text-gray-600">Нямате права за достъп до тази страница.</p>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}
