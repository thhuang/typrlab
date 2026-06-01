import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/theme.css';
import '@/app.css';
import '@/fonts-load';
import { ThemeScript } from './ThemeScript';
import { AppClient } from './AppClient';

export const metadata: Metadata = {
  title: 'typrlab — adaptive typing trainer',
  description: 'An adaptive typing trainer that drills your weakest keys and transitions.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <AppClient />
        {children}
      </body>
    </html>
  );
}
