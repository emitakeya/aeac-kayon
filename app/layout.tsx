import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AEAC Kayon',
  description: 'AEAC internal staff portal',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
