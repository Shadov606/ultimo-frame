import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ultimo Frame — Ricostruisci la scena mancante',
  description: 'Il party game investigativo da giocare a voce con gli amici.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="dark">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
