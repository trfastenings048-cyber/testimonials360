'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { toast } from 'sonner';
import {
  AlertCircle,
  Copy,
  ExternalLink,
  Film,
  Loader2,
  MonitorPlay,
  MoreHorizontal,
  Pencil,
  Play,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  deleteVideo,
  fetchVideos,
  renameVideo,
  updateDisplaySettings,
  uploadVideo,
  type VideoListQuery,
  type VideoListResponse,
  type VideoRecord,
  type VideoSortField,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { Dot, Pill } from '@/components/shared/Pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CHANNELS, type ContentEvents } from '@/lib/realtime/protocol';
import { useChannelMessages } from '@/lib/realtime/client';
import { useAdminData } from './AdminDataProvider';
import { PageHeader } from './PageHeader';
import { EmptyState } from './EmptyState';
import { PAGE_SIZES, Pagination } from './table/Pagination';
import { SortableHeader } from './table/SortableHeader';

// ---------------------------------------------------------------------------
// Query state (kept in the URL so refresh and shared links keep the view)
// ---------------------------------------------------------------------------

const SORT_FIELDS: VideoSortField[] = ['title', 'createdAt', 'duration', 'bytes', 'format'];
const DEFAULT_QUERY: VideoListQuery = { page: 1, pageSize: 10, sort: 'createdAt', order: 'desc', q: '' };

function readQuery(params: URLSearchParams): VideoListQuery {
  const pageSize = Number(params.get('pageSize'));
  const sort = params.get('sort') as VideoSortField | null;
  return {
    page: Math.max(1, Math.floor(Number(params.get('page')) || 1)),
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_QUERY.pageSize,
    sort: sort && SORT_FIELDS.includes(sort) ? sort : DEFAULT_QUERY.sort,
    order: params.get('order') === 'asc' ? 'asc' : params.get('order') === 'desc' ? 'desc' : DEFAULT_QUERY.order,
    q: params.get('q') || '',
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

const formatResolution = (video: VideoRecord) =>
  video.width && video.height ? `${video.width}×${video.height}` : '—';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const titleFromFileName = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function VideoThumbnail({ video, onClick }: { video: VideoRecord; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Preview ${video.title}`}
    >
      {failed ? (
        <Film className="size-5 text-white/70" aria-hidden="true" />
      ) : (
        <Image
          src={video.thumbnailUrl}
          alt=""
          fill
          unoptimized
          sizes="96px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/35" aria-hidden="true">
        <Play className="size-5 fill-white text-white opacity-0 transition group-hover:opacity-100" />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Upload sheet
// ---------------------------------------------------------------------------

function UploadVideoSheet({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (video: VideoRecord) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const reset = () => {
    setFile(null);
    setTitle('');
    setProgress(0);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pickFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.type.startsWith('video/')) {
      setError(`"${candidate.name}" is not a video file.`);
      return;
    }
    setError('');
    setFile(candidate);
    setTitle((current) => current || titleFromFileName(candidate.name));
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isUploading) pickFile(event.dataTransfer.files?.[0]);
  };

  const startUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsUploading(true);
    setError('');
    setProgress(0);
    try {
      const video = await uploadVideo(file, title.trim(), { onProgress: setProgress, signal: controller.signal });
      toast.success(`"${video.title}" uploaded`);
      onUploaded(video);
      reset();
      onOpenChange(false);
    } catch (uploadError) {
      if ((uploadError as Error)?.name === 'AbortError') {
        toast.info('Upload cancelled');
        setProgress(0);
      } else {
        setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
      }
    } finally {
      setIsUploading(false);
      abortRef.current = null;
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isUploading) {
          toast.warning('Cancel the upload before closing.');
          return;
        }
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent side="right" className="theme-tr">
        <SheetHeader className="border-b pr-14">
          <SheetTitle className="text-lg">Upload video</SheetTitle>
          <SheetDescription>
            The file goes straight from this browser to Cloudinary. Large files are sent in chunks.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={startUpload} className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              if (!isUploading) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed bg-surface-page/50 px-4 py-8 text-center transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
              isDragging ? 'border-accent-blue bg-accent-blue-soft' : 'border-border hover:border-accent-blue/60 hover:bg-accent-blue-soft/60',
              isUploading && 'pointer-events-none opacity-60'
            )}
          >
            <UploadCloud className="size-9 text-accent-blue-strong" aria-hidden="true" />
            {file ? (
              <>
                <span className="max-w-full truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(file.size)} · {file.type || 'video'} · click to change
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">Drop a video here, or click to choose</span>
                <span className="text-xs text-muted-foreground">MP4, MOV, WebM and other video formats</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="sr-only"
              disabled={isUploading}
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
          </label>

          <div className="space-y-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Event highlights"
              maxLength={200}
              disabled={isUploading}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">Shown in the table. Defaults to the file name.</p>
          </div>

          {(isUploading || progress > 0) && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{progress >= 100 ? 'Finishing…' : 'Uploading to Cloudinary…'}</span>
                <span className="tabular-nums text-muted-foreground">{progress}%</span>
              </div>
              <div
                className="h-[3px] overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Upload progress"
              >
                <div className="h-full rounded-full bg-ink transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="mt-auto flex gap-2 border-t pt-4">
            {isUploading ? (
              <Button type="button" variant="outline" className="h-10 flex-1" onClick={() => abortRef.current?.abort()}>
                <X /> Cancel upload
              </Button>
            ) : (
              <Button type="button" variant="outline" className="h-10 flex-1" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
            <Button
              type="submit"
              className="h-10 flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!file || isUploading}
            >
              {isUploading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
              {isUploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const dialogBackdrop =
  'fixed inset-0 z-[190] bg-black/60 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0';
const dialogPopup =
  'fixed top-1/2 left-1/2 z-[191] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card text-foreground shadow-2xl outline-none transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0';

function PreviewDialog({ video, onClose }: { video: VideoRecord | null; onClose: () => void }) {
  return (
    <Dialog.Root open={Boolean(video)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdrop} />
        <Dialog.Popup className={cn(dialogPopup, 'max-w-4xl overflow-hidden')}>
          {video && (
            <>
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <Dialog.Title className="truncate text-base font-medium">{video.title}</Dialog.Title>
                <Dialog.Close render={<Button variant="ghost" size="icon-lg" aria-label="Close preview" />}>
                  <X />
                </Dialog.Close>
              </div>
              <video src={video.url} controls autoPlay playsInline className="aspect-video w-full bg-ink" />
              <Dialog.Description className="px-4 py-3 text-xs text-muted-foreground">
                {video.format.toUpperCase()} · {formatResolution(video)} · {formatDuration(video.duration)} · {formatBytes(video.bytes)}
              </Dialog.Description>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RenameDialog({
  video,
  onClose,
  onRenamed,
}: {
  video: VideoRecord | null;
  onClose: () => void;
  onRenamed: (video: VideoRecord) => void;
}) {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const inputId = useId();

  // Seed the field when a different video is opened (adjusting state during render).
  if (video && video.id !== seededFor) {
    setSeededFor(video.id);
    setTitle(video.title);
  } else if (!video && seededFor !== null) {
    setSeededFor(null);
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!video || !title.trim()) return;
    setIsSaving(true);
    try {
      onRenamed(await renameVideo(video.id, title.trim()));
      toast.success('Video renamed');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename video');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={Boolean(video)} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdrop} />
        <Dialog.Popup className={cn(dialogPopup, 'max-w-md p-5')}>
          <form onSubmit={save} className="space-y-4">
            <Dialog.Title className="text-base font-medium">Rename video</Dialog.Title>
            <div className="space-y-2">
              <Label htmlFor={inputId}>Title</Label>
              <Input id={inputId} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-10" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Dialog.Close render={<Button type="button" variant="outline" className="h-10" disabled={isSaving} />}>
                Cancel
              </Dialog.Close>
              <Button type="submit" className="h-10" disabled={isSaving || !title.trim()}>
                {isSaving && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function VideosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useMemo(() => readQuery(new URLSearchParams(searchParams.toString())), [searchParams]);
  const { settings, setSettings, realtime, screens } = useAdminData();

  const [data, setData] = useState<VideoListResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  // Loading is derived: the request for the current query hasn't settled yet.
  const requestKey = `${query.page}|${query.pageSize}|${query.sort}|${query.order}|${query.q}|${reloadToken}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const isLoading = settledKey !== requestKey;
  const [searchInput, setSearchInput] = useState(query.q);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewing, setPreviewing] = useState<VideoRecord | null>(null);
  const [renaming, setRenaming] = useState<VideoRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VideoRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const updateQuery = useCallback(
    (patch: Partial<VideoListQuery>) => {
      const next = { ...query, ...patch };
      const params = new URLSearchParams();
      if (next.page !== DEFAULT_QUERY.page) params.set('page', String(next.page));
      if (next.pageSize !== DEFAULT_QUERY.pageSize) params.set('pageSize', String(next.pageSize));
      if (next.sort !== DEFAULT_QUERY.sort) params.set('sort', next.sort);
      if (next.order !== DEFAULT_QUERY.order) params.set('order', next.order);
      if (next.q) params.set('q', next.q);
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, query, router]
  );

  // Debounce typing into the URL so we don't refetch on every keystroke.
  useEffect(() => {
    if (searchInput.trim() === query.q) return;
    const timeout = setTimeout(() => updateQuery({ q: searchInput.trim(), page: 1 }), 300);
    return () => clearTimeout(timeout);
  }, [searchInput, query.q, updateQuery]);

  useEffect(() => {
    const controller = new AbortController();
    fetchVideos(query, controller.signal)
      .then((result) => {
        setData(result);
        setLoadError('');
        // Deleting the last row of the last page can leave us past the end.
        if (result.page > result.pageCount) updateQuery({ page: result.pageCount });
      })
      .catch((error) => {
        if ((error as Error)?.name !== 'AbortError') setLoadError(error instanceof Error ? error.message : 'Failed to load videos');
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledKey(requestKey);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey captures every input that should refetch
  }, [requestKey]);

  useEffect(() => {
    if (!highlightId) return;
    const timeout = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timeout);
  }, [highlightId]);

  const onSort = (field: VideoSortField) => {
    const order = query.sort === field ? (query.order === 'asc' ? 'desc' : 'asc') : field === 'title' || field === 'format' ? 'asc' : 'desc';
    updateQuery({ sort: field, order, page: 1 });
  };

  const onUploaded = (video: VideoRecord) => {
    setHighlightId(video.id);
    if (query.page === 1 && query.sort === 'createdAt' && query.order === 'desc' && !query.q) {
      setReloadToken((token) => token + 1);
    } else {
      // Jump to where the new upload is visible.
      setSearchInput('');
      updateQuery({ ...DEFAULT_QUERY, pageSize: query.pageSize });
    }
  };

  const onRenamed = (video: VideoRecord) => {
    setData((current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === video.id ? video : item)) } : current
    );
  };

  /** Switches the big screen to Video mode playing this specific video. */
  const playOnBigScreen = useCallback(
    async (video: Pick<VideoRecord, 'id' | 'title'>) => {
      try {
        const saved = await updateDisplaySettings({ mode: 'video', videoId: video.id });
        setSettings(saved);
        toast.success(`"${video.title}" is now playing on the big screen`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to play the video on the big screen');
      }
    },
    [setSettings]
  );

  // Keep the list in sync with uploads/deletes made from other tabs or devices.
  const screenIsShowingVideo = screens.some((screen) => screen.mode === 'video');
  useChannelMessages(realtime, CHANNELS.content, (message) => {
    if (message.name !== 'video.created' && message.name !== 'video.deleted') return;
    setReloadToken((token) => token + 1);
    // Never switch the screen automatically mid-playback; offer it instead.
    if (message.name === 'video.created' && screenIsShowingVideo) {
      const video = message.data as ContentEvents['video.created'];
      toast.info(`New video uploaded: "${video.title}"`, {
        description: 'The big screen is in Video mode.',
        action: { label: 'Play it now', onClick: () => void playOnBigScreen(video) },
        duration: 15000,
      });
    }
  });

  const copyLink = async (video: VideoRecord) => {
    try {
      await navigator.clipboard.writeText(video.url);
      toast.success('Video link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteVideo(pendingDelete.id);
      if (result.clearedFromDisplay) {
        setSettings((current) => ({ ...current, videoUrl: null, video: null }));
      }
      toast.success(
        result.clearedFromDisplay ? 'Video deleted and removed from the big screen' : 'Video deleted'
      );
      setPendingDelete(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete video');
    } finally {
      setIsDeleting(false);
    }
  };

  const isSelectedVideo = (video: VideoRecord) => (settings.video?.url ?? settings.videoUrl) === video.url;
  const isOnScreen = (video: VideoRecord) => isSelectedVideo(video) && settings.mode === 'video';

  const rowActions = (video: VideoRecord) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" aria-label={`Actions for ${video.title}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setPreviewing(video)}>
          <Play /> Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void playOnBigScreen(video)} disabled={isOnScreen(video)}>
          <MonitorPlay /> {isOnScreen(video) ? 'Playing on the big screen' : 'Play on big screen'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(video.url, '_blank', 'noopener,noreferrer')}>
          <ExternalLink /> Open in new tab
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyLink(video)}>
          <Copy /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setRenaming(video)}>
          <Pencil /> Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(video)}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const statusBadge = (video: VideoRecord) =>
    isOnScreen(video) ? (
      <Pill className="h-6 px-2.5 text-xs">
        <Dot tone="live" pulse className="size-1.5" />
        <MonitorPlay className="size-3" aria-hidden="true" /> On screen
      </Pill>
    ) : isSelectedVideo(video) ? (
      <Badge variant="soft">Last played</Badge>
    ) : (
      <Badge variant="muted">Library</Badge>
    );

  const items = data?.items ?? [];
  const showSkeleton = isLoading && !data;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete video?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" will be permanently deleted from Cloudinary and the library.${
                isSelectedVideo(pendingDelete)
                  ? ' It is the big-screen video, so the screen will be left without one until you pick another.'
                  : ''
              }`
            : ''
        }
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
      <PreviewDialog video={previewing} onClose={() => setPreviewing(null)} />
      <RenameDialog video={renaming} onClose={() => setRenaming(null)} onRenamed={onRenamed} />
      <UploadVideoSheet open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={onUploaded} />

      <PageHeader
        eyebrow="Library"
        title="Videos"
        description="Upload videos to Cloudinary and choose which one plays when the big screen is in Video mode."
        actions={
          <Button
            className="h-10 gap-2 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
            onClick={() => setUploadOpen(true)}
          >
            <UploadCloud /> Upload video
          </Button>
        }
      />

      <div className="admin-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by title or format…"
              aria-label="Search videos"
              className="h-10 pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isLoading && data && <Loader2 className="size-4 animate-spin" aria-label="Updating" />}
            {data && (
              <span>
                {data.total} video{data.total === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {loadError && !data ? (
          <EmptyState
            icon={<AlertCircle />}
            title="Couldn't load videos"
            description={loadError}
            action={
              <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
                Try again
              </Button>
            }
          />
        ) : showSkeleton ? (
          <div className="space-y-3 p-4" aria-label="Loading videos">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="aspect-video w-24" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/5" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Film />}
            title={query.q ? 'No videos match your search' : 'No videos yet'}
            description={
              query.q
                ? 'Try a different title or format.'
                : 'Upload a video to use it on the big screen in Video mode.'
            }
            action={
              query.q ? (
                <Button variant="outline" onClick={() => setSearchInput('')}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => setUploadOpen(true)}>
                  <UploadCloud /> Upload video
                </Button>
              )
            }
          />
        ) : (
          <div className={cn('transition-opacity', isLoading && 'opacity-60')}>
            {/* Mobile: cards */}
            <ul className="divide-y md:hidden">
              {items.map((video) => (
                <li
                  key={video.id}
                  className={cn('flex gap-3 p-3 transition-colors', highlightId === video.id && 'bg-accent-blue-soft')}
                >
                  <VideoThumbnail video={video} onClick={() => setPreviewing(video)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{video.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDuration(video.duration)} · {formatBytes(video.bytes)} · {video.format.toUpperCase()}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {statusBadge(video)}
                      <span className="text-xs text-muted-foreground">{formatDate(video.createdAt)}</span>
                    </div>
                  </div>
                  {rowActions(video)}
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  Uploaded videos, sorted by {query.sort} {query.order === 'asc' ? 'ascending' : 'descending'}
                </caption>
                <thead className="border-b bg-surface-page/80">
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <SortableHeader field="title" label="Video" query={query} onSort={onSort} />
                    <SortableHeader field="format" label="Format" query={query} onSort={onSort} />
                    <SortableHeader field="duration" label="Duration" query={query} onSort={onSort} className="text-right" />
                    <SortableHeader field="bytes" label="Size" query={query} onSort={onSort} className="text-right" />
                    <SortableHeader field="createdAt" label="Uploaded" query={query} onSort={onSort} />
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th scope="col" className="w-14 px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((video) => (
                    <tr
                      key={video.id}
                      className={cn('transition-colors hover:bg-surface-page/50', highlightId === video.id && 'bg-accent-blue-soft')}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <VideoThumbnail video={video} onClick={() => setPreviewing(video)} />
                          <div className="min-w-0">
                            <p className="max-w-56 truncate font-medium text-foreground" title={video.title}>
                              {video.title}
                            </p>
                            <p className="max-w-56 truncate font-display-mono text-xs text-muted-foreground" title={video.publicId}>
                              {video.publicId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-display-mono uppercase">
                          {video.format || '—'}
                        </Badge>
                        <p className="mt-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatResolution(video)}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatDuration(video.duration)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatBytes(video.bytes)}</td>
                      <td className="px-4 py-3 whitespace-nowrap" title={new Date(video.createdAt).toLocaleString()}>
                        <p className="text-foreground">{formatDay(video.createdAt)}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(video.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">{statusBadge(video)}</td>
                      <td className="px-4 py-3 text-right">{rowActions(video)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && data.total > 0 && (
          <Pagination
            data={data}
            onPage={(page) => updateQuery({ page })}
            onPageSize={(pageSize) => updateQuery({ pageSize, page: 1 })}
          />
        )}
      </div>
    </div>
  );
}
