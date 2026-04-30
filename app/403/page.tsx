import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3 text-xl">
          ⛔
        </div>
        <h1 className="text-base font-semibold text-neutral-900 mb-2">
          Akses Ditolak
        </h1>
        <p className="text-xs text-neutral-600 leading-relaxed mb-4">
          Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi admin
          jika Anda merasa ini adalah kesalahan.
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-xs px-4 py-2 rounded-md bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black font-medium transition"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </main>
  );
}
