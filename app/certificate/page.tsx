import type { Metadata } from 'next';
import CertificateSystem from '@/components/CertificateSystem';

export const metadata: Metadata = {
  title: 'TR FASTENING 360 Camera | Certificate',
  description: 'Share your experience and claim your personalised certificate',
};

export default function CertificatePage() {
  return <CertificateSystem />;
}
