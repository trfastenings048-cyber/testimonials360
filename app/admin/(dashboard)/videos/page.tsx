import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VideosPage } from '@/components/admin/VideosPage';

export const metadata: Metadata = { title: 'Videos' };

export default function AdminVideosPage() {
  // VideosPage reads its sort/page state from the URL (useSearchParams).
  return (
    <Suspense>
      <VideosPage />
    </Suspense>
  );
}
