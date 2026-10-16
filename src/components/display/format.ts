import type { CertificateRecord } from '@/lib/api';

export { pad2 } from '@/components/shared/CounterChip';
export { initials } from '@/components/shared/InitialAvatar';

/** "Designation at Team", falling back to "Participant". */
export const speakerRole = (testimonial: Pick<CertificateRecord, 'designation' | 'teamName'>) =>
  [testimonial.designation, testimonial.teamName].filter(Boolean).join(' at ') || 'Participant';

/** Longer quotes step down in size so up to three lines always fit the card. */
export const quoteScale = (text: string) => (text.length > 220 ? 0.72 : text.length > 140 ? 0.85 : 1);
