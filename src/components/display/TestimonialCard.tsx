import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Quote } from 'lucide-react';
import type { CertificateRecord } from '@/lib/api';
import { Arches } from '@/components/shared/Arches';
import { quoteScale } from './format';

/** Left card in the bottom row: the current quote, or the group name when there are no testimonials. */
export function TestimonialCard({
  testimonial,
  fallbackTitle,
}: {
  testimonial: CertificateRecord | null;
  fallbackTitle: string;
}) {
  const reduceMotion = useReducedMotion();
  const rise = reduceMotion ? 0 : 12;
  const quote = testimonial?.feedback?.trim() ?? '';

  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-[24px] bg-gradient-to-br from-display-quote-from from-20% to-display-quote-to px-[2.2vw] py-[2.4vh] display-shadow">
      <Arches />

      <header className="relative flex items-center gap-[0.8vw] text-[clamp(11px,0.85vw,16px)] font-medium text-display-ink">
        <span className="flex size-[clamp(26px,2.1vw,40px)] items-center justify-center rounded-full bg-display-ink text-white">
          <Quote className="size-[45%] fill-current" aria-hidden="true" />
        </span>
        Testimonial
      </header>

      <div className="relative mt-[1.6vh] flex min-h-0 flex-1 items-center" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {testimonial ? (
            <motion.blockquote
              key={testimonial.id}
              initial={{ opacity: 0, y: rise }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -rise }}
              transition={{ duration: 0.45 }}
              className="line-clamp-3 max-w-[92%] leading-[1.25] font-light text-display-ink"
              style={{ fontSize: `calc(clamp(22px, 2.4vw, 46px) * ${quoteScale(quote)})` }}
            >
              “{quote}”
            </motion.blockquote>
          ) : (
            <motion.div key="no-testimonial" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-[clamp(22px,2.4vw,46px)] leading-tight font-medium text-display-ink">{fallbackTitle}</p>
              <p className="mt-[0.6vh] text-[clamp(13px,1.1vw,20px)] text-display-ink/70">
                Group capture from the Sanitation Sandbox experience.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}
