import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortOrder = 'asc' | 'desc';

/** Column header that sorts by `field`; shows the current direction when active. */
export function SortableHeader<Field extends string>({
  field,
  label,
  query,
  onSort,
  className,
}: {
  field: Field;
  label: string;
  query: { sort: Field; order: SortOrder };
  onSort: (field: Field) => void;
  className?: string;
}) {
  const active = query.sort === field;
  const Icon = !active ? ArrowUpDown : query.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (query.order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-4 py-3 whitespace-nowrap', className)}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          '-mx-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          active && 'text-foreground'
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden="true" />
      </button>
    </th>
  );
}
