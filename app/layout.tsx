import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Карты PUBG RU',
  description: 'Интерактивные карты PUBG: метки, координатная сетка и измерение расстояния.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
