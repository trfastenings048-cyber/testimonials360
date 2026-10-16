import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OverviewPage } from '@/components/admin/OverviewPage';

export const metadata: Metadata = { title: 'Overview' };

export default function AdminOverviewPage() {
  // The content table reads its filter/sort/page state from the URL (useSearchParams).
  return (
    <Suspense>
      <OverviewPage />
    </Suspense>
  );
}
