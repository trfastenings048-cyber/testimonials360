'use client';

import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PAGE_SIZES = [10, 25, 50];

export type PageInfo = { page: number; pageSize: number; pageCount: number; total: number };

function pageNumbers(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap');
    result.push(p);
  });
  return result;
}

/** "Showing 1–10 of 42", rows-per-page select, and numbered page buttons. */
export function Pagination({
  data,
  onPage,
  onPageSize,
}: {
  data: PageInfo;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const sizeId = useId();
  const first = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const last = Math.min(data.page * data.pageSize, data.total);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <p aria-live="polite">
          Showing <span className="font-medium text-foreground tabular-nums">{first}–{last}</span> of{' '}
          <span className="font-medium text-foreground tabular-nums">{data.total}</span>
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="hidden sm:inline">
            Rows
          </label>
          <select
            id={sizeId}
            value={data.pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="h-8 rounded-full border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPage(data.page - 1)}
          disabled={data.page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        {pageNumbers(data.page, data.pageCount).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-sm text-muted-foreground" aria-hidden="true">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === data.page ? 'default' : 'ghost'}
              size="icon"
              className="tabular-nums"
              onClick={() => onPage(item)}
              aria-label={`Page ${item}`}
              aria-current={item === data.page ? 'page' : undefined}
            >
              {item}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPage(data.page + 1)}
          disabled={data.page >= data.pageCount}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}
