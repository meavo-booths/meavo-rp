import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { SIMULATE_HEADER, SIMULATE_QUERY_PARAM } from "@/lib/simulate-as";

/** Edge-safe auth — do not import `@/lib/auth` here (it pulls in Prisma). */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === "/manifest.webmanifest") return;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)) return;

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Per-tab simulation: forward ?as= into a request header so RSC + Server Actions
  // on this URL see the same persona (cookies are shared across tabs).
  const as = req.nextUrl.searchParams.get(SIMULATE_QUERY_PARAM)?.trim().toLowerCase();
  if (as && as.endsWith("@meavo.com")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(SIMULATE_HEADER, as);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
