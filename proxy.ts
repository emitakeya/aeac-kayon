import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // `tech-invoice` is public (token-gated, opened from an email link with no
    // login), so it's excluded here alongside `api` — updateSession never runs
    // on it and therefore can't redirect a tech to /login.
    '/((?!api|tech-invoice|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
