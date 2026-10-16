import { cn } from '@/lib/utils';

/** First letter of the name, for the avatar circle. */
export const initials = (name?: string | null) => name?.trim().charAt(0).toUpperCase() || '?';

/** Slate circle with the person's initial; size it with `size-*` and a text size. */
export function InitialAvatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-ink',
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
