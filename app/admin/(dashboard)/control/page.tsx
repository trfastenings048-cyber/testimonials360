import type { Metadata } from 'next';
import { ControlPage } from '@/components/admin/ControlPage';

export const metadata: Metadata = { title: 'Display control' };

export default function AdminControlPage() {
  return <ControlPage />;
}
