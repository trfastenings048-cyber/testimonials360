import { cn } from '@/lib/utils';

/** `3` → `"03"`. */
export const pad2 = (value: number) => String(value).padStart(2, '0');

/** Navy rounded chip with a monospace `01 / 03` position. */
export function CounterChip({ index, count, className }: { index: number; count: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-ink px-[0.8em] py-[0.25em] font-display-mono text-white tabular-nums',
        className
      )}
    >
      {pad2(index + 1)} / {pad2(count)}
    </span>
  );
}
