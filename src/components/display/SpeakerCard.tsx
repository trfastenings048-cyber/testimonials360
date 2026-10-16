import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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

  return (
    <aside className="display-shadow flex min-w-0 flex-col rounded-[24px] bg-white px-[1.7vw] py-[2.4vh]">
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
    </aside>
  );
}
