import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth

  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth') ||
    req.nextUrl.pathname === '/login'
  
  // Allow cron routes (protected by CRON_SECRET header instead)
  const isCronRoute = req.nextUrl.pathname.startsWith('/api/cron')

  // Allow auth and cron routes
  if (isAuthRoute || isCronRoute) {
    // Redirect logged-in users away from login page
    if (isLoggedIn && req.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // Require auth for all other routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
