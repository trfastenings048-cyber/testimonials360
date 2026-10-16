import type { Metadata } from 'next';
import { TestimonialsPage } from '@/components/admin/TestimonialsPage';

export const metadata: Metadata = { title: 'Testimonials' };

export default function AdminTestimonialsPage() {
  return <TestimonialsPage />;
}
