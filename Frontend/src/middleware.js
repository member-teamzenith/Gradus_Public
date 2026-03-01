import { NextResponse } from 'next/server';

export function middleware(request) {
    const maintenance = false;

    if (
        maintenance &&
        !request.nextUrl.pathname.startsWith('/maintenance')
    ) {
        return NextResponse.redirect(
            new URL('/maintenance', request.url)
        );
    }
}

//hello

// Only run middleware on page routes, exclude static files and API routes
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|manifest.json).*)',
    ],
};