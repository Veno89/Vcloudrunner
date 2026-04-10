import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/sign-in',
  '/register',
  '/invitations',
  '/api'
];

const SESSION_COOKIE_NAME = 'vcloudrunner_dashboard_session';

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID?.trim();

  if (sessionToken || demoUserId) {
    return NextResponse.next();
  }

  const signInUrl = new URL('/sign-in', request.url);
  signInUrl.searchParams.set('reason', 'sign-in-required');
  if (pathname !== '/') {
    signInUrl.searchParams.set('redirectTo', pathname);
  }

  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'
  ]
};
