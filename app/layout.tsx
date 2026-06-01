import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/theme.css';
import '@/app.css';
import '@/fonts-load';
import { ThemeScript } from './ThemeScript';
import { AppClient } from './AppClient';

const SITE = 'https://typrlab.com';
const TITLE = 'typrlab — adaptive typing trainer';
const DESCRIPTION =
  'typrlab is a free, adaptive typing trainer that pinpoints your weakest keys and transitions and drills only those — so practice time goes where it actually moves the needle. Local-first, no sign-up.';
const TAGLINE =
  'Practice less, type better — an adaptive trainer that drills your weak keys and transitions.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s · typrlab' },
  description: DESCRIPTION,
  applicationName: 'typrlab',
  keywords: [
    'typing trainer',
    'typing practice',
    'touch typing',
    'typing test',
    'adaptive typing',
    'learn to type',
    'typing speed',
    'wpm',
    'keyboard practice',
    'typrlab',
  ],
  authors: [{ name: 'thhuang', url: 'https://thhuang.github.io' }],
  creator: 'thhuang',
  category: 'education',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'typrlab',
    url: SITE,
    title: TITLE,
    description: TAGLINE,
    locale: 'en_US',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: TAGLINE,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

// Structured data so search engines understand what typrlab is (a free web app).
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'typrlab',
  url: SITE,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  description: DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'thhuang', url: 'https://thhuang.github.io' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        {/* Crawlable fallback for no-JS agents (the app itself is client-rendered). */}
        <noscript>
          <h1>typrlab — adaptive typing trainer</h1>
          <p>{DESCRIPTION}</p>
        </noscript>
        <AppClient />
        {children}
      </body>
    </html>
  );
}
