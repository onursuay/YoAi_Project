import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const locale = request.cookies.get('NEXT_LOCALE')?.value || 'tr'
  const response = NextResponse.next()
  
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }
  
  return response
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
}
