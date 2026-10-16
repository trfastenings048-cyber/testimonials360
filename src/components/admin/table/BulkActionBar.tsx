import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Pill } from '@/components/shared/Pill';

/** Floating pill at the bottom of the screen while table rows are selected. */
export function BulkActionBar({
  count,
  noun,
  onClear,
  children,
}: {
  count: number;
  noun: string;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <Pill
        role="toolbar"
        aria-label={`Actions for ${count} selected ${noun}${count === 1 ? '' : 's'}`}
        className="pointer-events-auto gap-1 py-1.5 pr-1.5 pl-4 text-sm shadow-xl"
      >
        <span className="mr-2 font-display-mono text-xs tabular-nums">
          {count} selected
        </span>
        {children}
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="ml-1 flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-slate-100 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" />
        </button>
      </Pill>
    </div>
  );
}
