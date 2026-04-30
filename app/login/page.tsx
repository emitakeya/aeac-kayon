'use client';

import { useActionState, useState } from 'react';
import {
  signInWithPassword,
  signInWithMagicLink,
  type AuthState,
} from './actions';

const initialState: AuthState = { ok: false };

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic'>('password');

  const [pwState, pwAction, pwPending] = useActionState(
    signInWithPassword,
    initialState,
  );
  const [mlState, mlAction, mlPending] = useActionState(
    signInWithMagicLink,
    initialState,
  );

  const state = mode === 'password' ? pwState : mlState;
  const pending = mode === 'password' ? pwPending : mlPending;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-aeac-amber-500 text-black font-bold text-xl mb-3">
            AEAC
          </div>
          <h1 className="text-lg font-semibold text-neutral-900">Kayon</h1>
          <p className="text-xs text-neutral-500 mt-1">Portal Staf AEAC</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 border-b border-neutral-200">
            <button
              type="button"
              onClick={() => setMode('password')}
              className={`px-4 py-3 text-sm font-medium transition ${
                mode === 'password'
                  ? 'bg-white text-aeac-amber-700 border-b-2 border-aeac-amber-500'
                  : 'bg-neutral-50 text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode('magic')}
              className={`px-4 py-3 text-sm font-medium transition ${
                mode === 'magic'
                  ? 'bg-white text-aeac-amber-700 border-b-2 border-aeac-amber-500'
                  : 'bg-neutral-50 text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Link Email
            </button>
          </div>

          <div className="p-5">
            {mode === 'password' ? (
              <form action={pwAction} className="space-y-3">
                <Field label="Email" name="email" type="email" autoComplete="email" required />
                <Field label="Password" name="password" type="password" autoComplete="current-password" required />
                <SubmitButton pending={pending}>Masuk</SubmitButton>
              </form>
            ) : (
              <form action={mlAction} className="space-y-3">
                <Field label="Email" name="email" type="email" autoComplete="email" required />
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Kami akan mengirim link login ke email Anda. Klik link itu untuk masuk tanpa password.
                </p>
                <SubmitButton pending={pending}>Kirim Link Login</SubmitButton>
              </form>
            )}

            {state.message ? (
              <div
                className={`mt-3 text-xs px-3 py-2 rounded-md ${
                  state.variant === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {state.message}
              </div>
            ) : null}
          </div>
        </div>

        <p className="text-[11px] text-neutral-400 text-center mt-4">
          Hanya untuk staf terdaftar. Hubungi admin jika tidak bisa masuk.
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-700 mb-1">{label}</span>
      <input
        {...props}
        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-aeac-amber-500 focus:border-transparent transition"
      />
    </label>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-aeac-amber-500 hover:bg-aeac-amber-600 disabled:bg-neutral-300 disabled:cursor-not-allowed text-black font-medium text-sm px-4 py-2.5 rounded-md transition"
    >
      {pending ? 'Memproses…' : children}
    </button>
  );
}
