'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type AuthState = {
  ok: boolean;
  message?: string;
  variant?: 'success' | 'error';
};

// Only allow same-origin internal paths (e.g. "/booking-staff?ref=..."), never
// an absolute URL or protocol-relative "//host". Falls back to /dashboard.
function safeNext(raw: string): string {
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(String(formData.get('next') ?? ''));

  if (!email || !password) {
    return { ok: false, message: 'Email dan password wajib diisi.', variant: 'error' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, message: 'Email atau password salah.', variant: 'error' };
  }

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signInWithMagicLink(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const next = safeNext(String(formData.get('next') ?? ''));

  if (!email) {
    return { ok: false, message: 'Email wajib diisi.', variant: 'error' };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const origin =
    headersList.get('origin') ??
    `https://${headersList.get('host') ?? 'localhost:3000'}`;

  const callback =
    next === '/dashboard'
      ? `${origin}/auth/callback`
      : `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callback,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return {
      ok: false,
      message: 'Gagal mengirim link login. Coba lagi atau gunakan password.',
      variant: 'error',
    };
  }

  return {
    ok: true,
    message: 'Link login telah dikirim. Cek email Anda.',
    variant: 'success',
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
