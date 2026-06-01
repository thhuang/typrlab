import type { MetadataRoute } from 'next';

// Static sitemap (the app is a static export). Lists the three real routes.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://typrlab.com';
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/analysis`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/settings`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
