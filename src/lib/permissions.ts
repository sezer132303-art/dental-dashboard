import { User, UserRole, ROLE_PERMISSIONS, Permission } from '@/types'

// Check if user has a specific permission
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false
  const permissions = ROLE_PERMISSIONS[user.role] as readonly string[]
  return permissions.includes(permission)
}

// Check if user has any of the given permissions
export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false
  return permissions.some(p => hasPermission(user, p))
}

// Check if user has all of the given permissions
export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false
  return permissions.every(p => hasPermission(user, p))
}

// Get all permissions for a role
export function getPermissionsForRole(role: UserRole): readonly string[] {
  return ROLE_PERMISSIONS[role]
}

// Check if user can access a specific route
export function canAccessRoute(user: User | null, route: string): boolean {
  if (!user) return false

  const routePermissions: Record<string, Permission[]> = {
    '/': ['view:dashboard'],
    '/appointments': ['view:appointments'],
    '/patients': ['view:patients'],
    '/doctors': ['view:doctors'],
    '/calendar': ['view:calendar'],
    '/settings': ['view:settings'],
    '/admin/users': ['view:users'],
    '/admin/clinics': ['view:clinics']
  }

  const requiredPermissions = routePermissions[route]
  if (!requiredPermissions) return true // Unknown routes are accessible

  return hasAnyPermission(user, requiredPermissions)
}

// Role display names in Bulgarian
export const ROLE_NAMES: Record<UserRole, string> = {
  admin: 'Администратор',
  doctor: 'Лекар',
  receptionist: 'Рецепция'
}

// Role colors for UI
export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-800',
  doctor: 'bg-blue-100 text-blue-800',
  receptionist: 'bg-green-100 text-green-800'
}
