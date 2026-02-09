import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/login', '/auth/verify', '/auth/forgot-password', '/auth/reset-password']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('session')

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    // Reset password and forgot password should ALWAYS be accessible (even with active session)
    // This is critical for password reset flow to work correctly
    if (pathname.startsWith('/auth/reset-password') || pathname.startsWith('/auth/forgot-password')) {
      const response = NextResponse.next()
      // Prevent caching of these pages
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      return response
    }

    // If user is already authenticated, redirect to appropriate dashboard
    if (session) {
      try {
        const sessionData = JSON.parse(session.value)
        if (sessionData.role === 'clinic') {
          return NextResponse.redirect(new URL('/clinic', request.url))
        }
      } catch {
        // Invalid session, continue to login
      }
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Check authentication for protected routes
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Parse session and check expiry
  let sessionData
  try {
    sessionData = JSON.parse(session.value)
    if (new Date(sessionData.expires) < new Date()) {
      // Session expired, redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('session')
      return response
    }
  } catch {
    // Invalid session, redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    return response
  }

  // Clinic users can only access /clinic routes
  if (sessionData.role === 'clinic') {
    if (!pathname.startsWith('/clinic')) {
      return NextResponse.redirect(new URL('/clinic', request.url))
    }
    return NextResponse.next()
  }

  // Non-clinic users cannot access /clinic routes
  if (pathname.startsWith('/clinic')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Check admin routes
  if (pathname.startsWith('/admin')) {
    if (sessionData.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'
  ]
}
