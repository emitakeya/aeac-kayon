import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Magic link landing endpoint.
 * Supabase redirects users here with `?code=...` after they click the email link.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=magic_link_failed`);
}
