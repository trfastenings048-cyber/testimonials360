'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import QRCode from 'qrcode';
import type { CertificateRecord } from '@/lib/api';
import { InitialAvatar } from '@/components/shared/InitialAvatar';
import { speakerRole } from './format';

/** Right card in the bottom row: who said the current quote, and who is next. */
export function SpeakerCard({
  testimonial,
  next,
  fallbackTitle,
}: {
  testimonial: CertificateRecord | null;
  next: CertificateRecord | null;
  fallbackTitle: string;
}) {
  const reduceMotion = useReducedMotion();
  const rise = reduceMotion ? 0 : 12;
  const name = testimonial ? testimonial.userName || 'Anonymous' : fallbackTitle;
  const role = testimonial ? speakerRole(testimonial) : 'Group photo';
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL('https://testimonials360.vercel.app/certificate', {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: { dark: '#032b69', light: '#ffffff' },
    }).then((url) => {
      if (active) setQrCode(url);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="display-shadow grid min-w-0 grid-cols-2 divide-x divide-slate-200 rounded-[24px] bg-white">
      <div className="flex min-w-0 flex-col px-[1.7vw] py-[2.4vh]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={testimonial?.id ?? 'no-testimonial'}
            initial={{ opacity: 0, y: rise }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -rise }}
            transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.08 }}
            className="flex min-w-0 flex-1 items-center gap-[1.1vw]"
          >
            <InitialAvatar name={name} className="size-[clamp(40px,3.4vw,72px)] text-[clamp(16px,1.3vw,28px)]" />
            <div className="min-w-0">
              <p className="truncate text-[clamp(18px,1.6vw,32px)] leading-tight font-medium text-display-ink">{name}</p>
              <p className="truncate text-[clamp(12px,0.98vw,19px)] text-display-muted">{role}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        {next && (
          <div className="mt-[1.4vh] flex items-center justify-between gap-[1vw] border-t border-slate-200 pt-[1.4vh] text-[clamp(11px,0.85vw,16px)]">
            <span className="shrink-0 text-display-muted">Up next</span>
            <span className="truncate text-[1.2em] text-display-ink">{next.userName || 'Anonymous'}</span>
          </div>
        )}
      </div>

      <a
        href="https://testimonials360.vercel.app/certificate"
        target="_blank"
        rel="noreferrer"
        aria-label="Open certificate page"
        className="flex min-w-0 flex-col items-center justify-center gap-[0.6vh] px-[1vw] py-[1.4vh] transition-colors hover:bg-slate-50"
      >
        {qrCode ? (
          <img src={qrCode} alt="QR code for the certificate page" className="size-[clamp(64px,7vw,132px)] rounded-md" />
        ) : (
          <div className="size-[clamp(64px,7vw,132px)] animate-pulse rounded-md bg-slate-100" aria-hidden="true" />
        )}
        <span className="text-center text-[clamp(10px,0.78vw,15px)] font-medium text-display-muted">Scan for certificates</span>
      </a>
    </aside>
  );
}
