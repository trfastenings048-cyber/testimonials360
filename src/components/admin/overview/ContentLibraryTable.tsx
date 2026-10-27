'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Eye, EyeOff, ImagePlus, Images, Loader2, Search, Trash2, X } from 'lucide-react';
import { deleteImage as deleteImageApi, downloadGroupImage, updateImageVisibility } from '@/lib/api';
import { imageSrc } from '@/lib/image-urls';
import { cn } from '@/lib/utils';
import type { EventImage } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '../EmptyState';
import { BulkActionBar } from '../table/BulkActionBar';
import { PAGE_SIZES, Pagination } from '../table/Pagination';
import { SortableHeader, type SortOrder } from '../table/SortableHeader';
import { getImageStatuses, timeAgo, type ImageStatus } from './imageStatus';
import { formatDay, formatTime, ImageStatusPill as StatusPill, STATUS_LABEL } from './ImageStatusPill';
import { ImagePreviewDialog } from './ImagePreviewDialog';

// ---------------------------------------------------------------------------
// Query state (in the URL so a refresh keeps the view)
// ---------------------------------------------------------------------------

type SortField = 'group' | 'uploaded' | 'status';
type StatusFilter = 'all' | ImageStatus;
type LibraryQuery = { q: string; status: StatusFilter; sort: SortField; order: SortOrder; page: number; pageSize: number };

const DEFAULT_QUERY: LibraryQuery = { q: '', status: 'all', sort: 'uploaded', order: 'desc', page: 1, pageSize: 10 };
const STATUS_FILTERS: StatusFilter[] = ['all', 'on-screen', 'replaced', 'hidden'];
const SORT_FIELDS: SortField[] = ['group', 'uploaded', 'status'];
/** Bulk deletes above this size ask the admin to type DELETE. */
const TYPE_TO_CONFIRM_OVER = 5;

function readQuery(params: URLSearchParams): LibraryQuery {
  const pageSize = Number(params.get('pageSize'));
  const sort = params.get('sort') as SortField | null;
  const status = params.get('status') as StatusFilter | null;
  return {
    q: params.get('q') || '',
    status: status && STATUS_FILTERS.includes(status) ? status : DEFAULT_QUERY.status,
    sort: sort && SORT_FIELDS.includes(sort) ? sort : DEFAULT_QUERY.sort,
    order: params.get('order') === 'asc' ? 'asc' : params.get('order') === 'desc' ? 'desc' : DEFAULT_QUERY.order,
    page: Math.max(1, Math.floor(Number(params.get('page')) || 1)),
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_QUERY.pageSize,
  };
}

const STATUS_ORDER: Record<ImageStatus, number> = { 'on-screen': 0, replaced: 1, hidden: 2 };

/** Runs `task` over `items` a few at a time and reports how many failed. */
async function runInBatches<T>(items: T[], task: (item: T) => Promise<unknown>, size = 4) {
  let failed = 0;
  for (let index = 0; index < items.length; index += size) {
    const results = await Promise.allSettled(items.slice(index, index + size).map(task));
    failed += results.filter((result) => result.status === 'rejected').length;
  }
  return failed;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Thumbnail({ image, onClick, className }: { image: EventImage; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Preview ${image.groupName}`}
      className={cn(
        'group relative shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <Image src={imageSrc(image, 'thumb')} alt="" fill unoptimized sizes="(min-width: 768px) 72px, 100vw" className="object-cover" />
      <span className="absolute inset-0 flex items-center justify-center bg-ink/0 transition group-hover:bg-ink/35" aria-hidden="true">
        <Eye className="size-4 text-white opacity-0 transition group-hover:opacity-100" />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function ContentLibraryTable({
  images,
  setImages,
  loading,
  highlightId,
  onUploadClick,
}: {
  images: EventImage[];
  setImages: Dispatch<SetStateAction<EventImage[]>>;
  loading: boolean;
  highlightId: string | null;
  onUploadClick: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useMemo(() => readQuery(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [search, setSearch] = useState(query.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<EventImage[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const updateQuery = useCallback(
    (patch: Partial<LibraryQuery>) => {
      const next = { ...query, ...patch };
      const params = new URLSearchParams();
      if (next.q) params.set('q', next.q);
      if (next.status !== DEFAULT_QUERY.status) params.set('status', next.status);
      if (next.sort !== DEFAULT_QUERY.sort) params.set('sort', next.sort);
      if (next.order !== DEFAULT_QUERY.order) params.set('order', next.order);
      if (next.page !== DEFAULT_QUERY.page) params.set('page', String(next.page));
      if (next.pageSize !== DEFAULT_QUERY.pageSize) params.set('pageSize', String(next.pageSize));
      const value = params.toString();
      router.replace(value ? `${pathname}?${value}` : pathname, { scroll: false });
    },
    [pathname, query, router]
  );

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search === query.q) return;
    const timer = window.setTimeout(() => updateQuery({ q: search, page: 1 }), 150);
    return () => window.clearTimeout(timer);
  }, [search, query.q, updateQuery]);

  const statuses = useMemo(() => getImageStatuses(images), [images]);
  const statusOf = useCallback((image: EventImage) => statuses.get(image.id) ?? { status: 'hidden' as const }, [statuses]);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: images.length, 'on-screen': 0, replaced: 0, hidden: 0 };
    images.forEach((image) => (result[statusOf(image).status] += 1));
    return result;
  }, [images, statusOf]);

  const rows = useMemo(() => {
    const needle = query.q.trim().toLowerCase();
    const filtered = images.filter(
      (image) =>
        (query.status === 'all' || statusOf(image).status === query.status) &&
        (!needle || image.groupName.toLowerCase().includes(needle))
    );
    const direction = query.order === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      const primary =
        query.sort === 'group'
          ? a.groupName.localeCompare(b.groupName, undefined, { numeric: true, sensitivity: 'base' })
          : query.sort === 'status'
            ? STATUS_ORDER[statusOf(a).status] - STATUS_ORDER[statusOf(b).status]
            : a.timestamp - b.timestamp;
      return primary * direction || b.timestamp - a.timestamp;
    });
  }, [images, query, statusOf]);

  const pageCount = Math.max(1, Math.ceil(rows.length / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const pageRows = rows.slice((page - 1) * query.pageSize, page * query.pageSize);

  // Drop selections for rows that no longer exist (deleted here or elsewhere).
  const liveSelected = useMemo(() => new Set([...selected].filter((id) => images.some((image) => image.id === id))), [selected, images]);
  const selectedImages = images.filter((image) => liveSelected.has(image.id));
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((image) => liveSelected.has(image.id));
  const someOnPageSelected = pageRows.some((image) => liveSelected.has(image.id));

  const onSort = (field: SortField) =>
    updateQuery({
      sort: field,
      order: query.sort === field ? (query.order === 'asc' ? 'desc' : 'asc') : field === 'uploaded' ? 'desc' : 'asc',
      page: 1,
    });

  const toggleRow = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      pageRows.forEach((image) => (allOnPageSelected ? next.delete(image.id) : next.add(image.id)));
      return next;
    });

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const setVisibility = async (image: EventImage, isVisible: boolean) => {
    await updateImageVisibility(image.id, isVisible);
    setImages((current) => current.map((item) => (item.id === image.id ? { ...item, isVisible } : item)));
  };

  const toggleVisibility = async (image: EventImage) => {
    setBusy(image.id, true);
    try {
      await setVisibility(image, !image.isVisible);
      toast.success(`${image.groupName} ${image.isVisible ? 'hidden' : 'visible'}`);
    } catch {
      toast.error('Failed to update visibility');
    } finally {
      setBusy(image.id, false);
    }
  };

  const bulkVisibility = async (isVisible: boolean) => {
    const targets = selectedImages.filter((image) => image.isVisible !== isVisible);
    if (!targets.length) {
      toast(`All selected photos are already ${isVisible ? 'visible' : 'hidden'}`);
      return;
    }
    setBulkBusy(true);
    const failed = await runInBatches(targets, (image) => setVisibility(image, isVisible));
    setBulkBusy(false);
    const done = targets.length - failed;
    if (done) toast.success(`${done} photo${done === 1 ? '' : 's'} ${isVisible ? 'shown' : 'hidden'}`);
    if (failed) toast.error(`${failed} photo${failed === 1 ? '' : 's'} couldn't be updated`);
  };

  const download = async (image: EventImage) => {
    setBusy(image.id, true);
    try {
      const { blob, filename } = await downloadGroupImage(image);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      toast.success(`${image.groupName} image downloaded`);
    } catch (error) {
      console.error('Failed to download group image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download group image');
    } finally {
      setBusy(image.id, false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete?.length) return;
    setIsDeleting(true);
    const deletedIds: string[] = [];
    const failed = await runInBatches(pendingDelete, async (image) => {
      await deleteImageApi(image.id);
      deletedIds.push(image.id);
    });
    setImages((current) => current.filter((image) => !deletedIds.includes(image.id)));
    setSelected((current) => new Set([...current].filter((id) => !deletedIds.includes(id))));
    setIsDeleting(false);
    setPendingDelete(null);
    if (deletedIds.length) toast.success(`${deletedIds.length} photo${deletedIds.length === 1 ? '' : 's'} deleted`);
    if (failed) toast.error(`${failed} photo${failed === 1 ? '' : 's'} couldn't be deleted`);
  };

  const rowActions = (image: EventImage) => {
    const busy = busyIds.has(image.id);
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={() => void download(image)}
          disabled={busy}
          className="text-accent-blue-strong hover:bg-accent-blue-soft hover:text-ink"
          aria-label={`Download ${image.groupName}`}
          title="Download"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Download />}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={() => setPendingDelete([image])}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${image.groupName}`}
          title="Delete"
        >
          <Trash2 />
        </Button>
      </div>
    );
  };

  const visibilitySwitch = (image: EventImage) => (
    <Switch
      checked={image.isVisible}
      disabled={busyIds.has(image.id)}
      onCheckedChange={() => void toggleVisibility(image)}
      aria-label={`Show ${image.groupName} on the big screen`}
    />
  );

  const openPreview = (image: EventImage) => {
    const index = rows.findIndex((row) => row.id === image.id);
    if (index >= 0) setPreviewIndex(index);
  };

  const filtersActive = Boolean(query.q) || query.status !== 'all';
  const clearFilters = () => {
    setSearch('');
    updateQuery({ q: '', status: 'all', page: 1 });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const deleteCount = pendingDelete?.length ?? 0;

  return (
    <section className="admin-card overflow-hidden" aria-labelledby="library-heading">
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={deleteCount === 1 ? 'Delete this photo?' : `Delete ${deleteCount} photos?`}
        description={
          deleteCount === 1
            ? `"${pendingDelete?.[0]?.groupName ?? ''}" will be removed from the library and the big screen.`
            : `These ${deleteCount} photos will be removed from the library and the big screen.`
        }
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
        isLoading={isDeleting}
        requireText={deleteCount > TYPE_TO_CONFIRM_OVER ? 'DELETE' : undefined}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ImagePreviewDialog
        images={rows}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        statusOf={statusOf}
        busy={previewIndex !== null && rows[previewIndex] ? busyIds.has(rows[previewIndex].id) : false}
        onToggleVisibility={(image) => void toggleVisibility(image)}
        onDownload={(image) => void download(image)}
        onDelete={(image) => {
          setPreviewIndex(null);
          setPendingDelete([image]);
        }}
      />

      {/* Header + toolbar */}
      <div className="space-y-3 border-b px-4 py-4 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 id="library-heading" className="text-base font-medium text-ink">
              Content library
            </h2>
            <p className="text-sm text-muted-foreground">Everything uploaded, and what the big screen is showing.</p>
          </div>
          <p className="shrink-0 font-display-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {rows.length} photo{rows.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search groups…"
              aria-label="Search groups"
              className="h-10 pr-9 pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="-mx-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ToggleGroup
              value={[query.status]}
              onValueChange={(value) => {
                const next = value[0] as StatusFilter | undefined;
                if (next) updateQuery({ status: next, page: 1 });
              }}
              aria-label="Filter by status"
            >
              {STATUS_FILTERS.map((status) => (
                <ToggleGroupItem key={status} value={status} className="gap-2 whitespace-nowrap">
                  {status === 'all' ? 'All' : STATUS_LABEL[status]}
                  <span className="font-display-mono text-[11px] opacity-70 tabular-nums">{counts[status]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      {loading ? (
        <div aria-label="Loading content" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-11 w-[72px] rounded-xl" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : images.length === 0 ? (
        <EmptyState
          icon={<Images />}
          title="No photos yet"
          description="Upload the first group photo and it will appear on the big screen."
          action={
            <Button className="h-10 gap-2 px-5" onClick={onUploadClick}>
              <ImagePlus /> Upload new content
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-ink">{query.q ? `No photos match “${query.q}”` : 'No photos with this status'}</p>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="mt-2 text-sm font-medium text-accent-blue-strong underline underline-offset-2">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-3 p-3 md:hidden">
            {pageRows.map((image) => {
              const info = statusOf(image);
              return (
                <li
                  key={image.id}
                  className={cn(
                    'space-y-3 rounded-2xl bg-surface-page/60 p-3 transition-colors',
                    highlightId === image.id && 'bg-accent-blue-soft'
                  )}
                >
                  <div className="relative">
                    <Thumbnail image={image} onClick={() => openPreview(image)} className="aspect-video w-full rounded-2xl" />
                    <Checkbox
                      checked={liveSelected.has(image.id)}
                      onCheckedChange={() => toggleRow(image.id)}
                      aria-label={`Select ${image.groupName}`}
                      className="absolute top-3 left-3 size-5 bg-[#16213e]"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{image.groupName}</p>
                      <p className="font-display-mono text-xs text-muted-foreground">
                        {formatDay(image.timestamp)} {formatTime(image.timestamp)}
                      </p>
                    </div>
                    <StatusPill info={info} />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      {image.isVisible ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                      Show on screen
                      {visibilitySwitch(image)}
                    </label>
                    {rowActions(image)}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="admin-table-scroll hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b bg-surface-page/80">
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th scope="col" className="w-12 px-4 py-3 sm:pl-6">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={!allOnPageSelected && someOnPageSelected}
                      onCheckedChange={togglePage}
                      aria-label="Select all photos on this page"
                    />
                  </th>
                  <th scope="col" className="w-24 px-4 py-3">
                    Photo
                  </th>
                  <SortableHeader field="group" label="Group" query={query} onSort={onSort} />
                  <SortableHeader field="uploaded" label="Uploaded" query={query} onSort={onSort} />
                  <SortableHeader field="status" label="Status" query={query} onSort={onSort} />
                  <th scope="col" className="w-20 px-4 py-3">
                    Show
                  </th>
                  <th scope="col" className="w-28 px-4 py-3 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pageRows.map((image) => (
                  <tr
                    key={image.id}
                    className={cn(
                      'h-16 transition-colors hover:bg-surface-page/50',
                      liveSelected.has(image.id) && 'bg-accent-blue-soft/50',
                      highlightId === image.id && 'bg-accent-blue-soft'
                    )}
                  >
                    <td className="px-4 py-2 sm:pl-6">
                      <Checkbox
                        checked={liveSelected.has(image.id)}
                        onCheckedChange={() => toggleRow(image.id)}
                        aria-label={`Select ${image.groupName}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Thumbnail image={image} onClick={() => openPreview(image)} className="h-11 w-[72px]" />
                    </td>
                    <td className="max-w-64 px-4 py-2">
                      <p className="truncate font-medium text-ink" title={image.groupName}>
                        {image.groupName}
                      </p>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" title={timeAgo(image.timestamp)}>
                      <p className="font-display-mono text-xs text-ink">{formatDay(image.timestamp)}</p>
                      <p className="font-display-mono text-xs text-muted-foreground">{formatTime(image.timestamp)}</p>
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill info={statusOf(image)} />
                    </td>
                    <td className="px-4 py-2">{visibilitySwitch(image)}</td>
                    <td className="px-4 py-2 sm:pr-6">{rowActions(image)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            data={{ page, pageSize: query.pageSize, pageCount, total: rows.length }}
            onPage={(next) => updateQuery({ page: next })}
            onPageSize={(pageSize) => updateQuery({ pageSize, page: 1 })}
          />
        </>
      )}

      <BulkActionBar count={liveSelected.size} noun="photo" onClear={() => setSelected(new Set())}>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5" disabled={bulkBusy} onClick={() => void bulkVisibility(true)}>
          <Eye /> Show
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5" disabled={bulkBusy} onClick={() => void bulkVisibility(false)}>
          <EyeOff /> Hide
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={bulkBusy}
          onClick={() => setPendingDelete(selectedImages)}
        >
          <Trash2 /> Delete
        </Button>
        {bulkBusy && <Loader2 className="mx-1 size-4 animate-spin text-muted-foreground" aria-label="Working" />}
      </BulkActionBar>
    </section>
  );
}
