import type { Metadata } from 'next';
import { OverviewPage } from '@/components/admin/OverviewPage';

export const metadata: Metadata = { title: 'Overview' };

export default function AdminOverviewPage() {
  return <OverviewPage />;
}
