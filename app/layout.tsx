import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Карты PUBG RU',
  description: 'Интерактивные карты PUBG: метки, координатная сетка и измерение расстояния.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f5f7',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(()=>{let theme='system';try{theme=localStorage.getItem('pubg-maps-theme')||'system'}catch{}document.documentElement.dataset.theme=theme==='dark'||(theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'})()` }}/></head><body>{children}</body></html>;
}
