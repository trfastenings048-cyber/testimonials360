import type { Metadata } from 'next';
import CertificateSystem from '@/components/CertificateSystem';

export const metadata: Metadata = {
  title: 'TR FASTENING 360 Camera | Certificate',
  description: 'Claim your personalised certificate and group photo',
};

export default function CertificatePage() {
  return <CertificateSystem />;
}
