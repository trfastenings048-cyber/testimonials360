import { cn } from '@/lib/utils';

/** Two nested outline arches anchored bottom-right; decoration for the signature gradient. */
export function Arches({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 220"
      preserveAspectRatio="xMaxYMax meet"
      className={cn('pointer-events-none absolute right-0 bottom-0 h-[115%] text-white/55', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M10 220V120Q10 70 60 50L110 30Q160 10 210 30L260 50Q310 70 310 120V220" />
      <path d="M60 220V140Q60 105 95 92L130 79Q160 68 190 79L225 92Q260 105 260 140V220" />
    </svg>
  );
}
