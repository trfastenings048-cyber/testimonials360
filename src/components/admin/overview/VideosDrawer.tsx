'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Suspense } from 'react';
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
  Upload,
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CHANNELS, type ContentEvents } from '@/lib/realtime/protocol';
import { useChannelMessages } from '@/lib/realtime/client';
import { useAdminData } from '../AdminDataProvider';
import { Pill, Dot } from '@/components/shared/Pill';
import { PAGE_SIZES, Pagination } from '../table/Pagination';
import { SortableHeader } from '../table/SortableHeader';

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

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`;
};

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function VideoThumbnail({ video, onClick }: { video: VideoRecord; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-video w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1a2544] outline-none focus-visible:ring-2 focus-visible:ring-[#9bb3ff] cursor-pointer"
      aria-label={`Preview ${video.title}`}
    >
      {failed ? (
        <Film className="size-4 text-slate-400" />
      ) : (
        <Image src={video.thumbnailUrl} alt="" fill unoptimized sizes="80px" className="object-cover" onError={() => setFailed(true)} />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
        <Play className="size-4 fill-white text-white opacity-0 transition group-hover:opacity-100" />
      </span>
    </button>
  );
}

function VideoPreviewDialog({ video, onClose }: { video: VideoRecord | null; onClose: () => void }) {
  return (
    <Dialog.Root open={Boolean(video)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[201] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-[#0e1628] border border-slate-700 text-white shadow-2xl outline-none">
          {video && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                <Dialog.Title className="truncate text-base font-semibold text-white">{video.title}</Dialog.Title>
                <Dialog.Close render={<button type="button" aria-label="Close" className="size-8 rounded-full bg-[#16213e] border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer" />}>
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <video src={video.url} controls autoPlay playsInline className="aspect-video w-full bg-black" />
              <Dialog.Description className="px-4 py-3 text-xs text-slate-400">
                {video.format.toUpperCase()} · {video.width && video.height ? `${video.width}×${video.height}` : '—'} · {formatDuration(video.duration)} · {formatBytes(video.bytes)}
              </Dialog.Description>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RenameDialog({ video, onClose, onRenamed }: { video: VideoRecord | null; onClose: () => void; onRenamed: (v: VideoRecord) => void }) {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (video && video.id !== seededFor) { setSeededFor(video.id); setTitle(video.title); }
  else if (!video && seededFor !== null) setSeededFor(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!video || !title.trim()) return;
    setIsSaving(true);
    try {
      onRenamed(await renameVideo(video.id, title.trim()));
      toast.success('Video renamed');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={Boolean(video)} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[201] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-[#0e1628] border border-slate-700 p-6 text-white shadow-2xl outline-none">
          <form onSubmit={save} className="space-y-4">
            <Dialog.Title className="text-base font-semibold text-white">Rename video</Dialog.Title>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus className="h-10 bg-[#131b31] border-slate-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Dialog.Close render={<button type="button" disabled={isSaving} className="rounded-full border border-slate-700 text-slate-300 hover:text-white py-2 text-xs font-medium cursor-pointer" />}>Cancel</Dialog.Close>
              <button type="submit" disabled={isSaving || !title.trim()} className="rounded-full bg-[#9bb3ff] hover:bg-[#88a3f8] text-[#0b1228] py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving && <Loader2 className="size-3.5 animate-spin" />}Save
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UploadSheet({ open, onOpenChange, onUploaded }: { open: boolean; onOpenChange: (open: boolean) => void; onUploaded: (v: VideoRecord) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setFile(null); setTitle(''); setProgress(0); setError(''); };

  if (!open) return null;

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) { setError(`"${f.name}" is not a video.`); return; }
    setError('');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim());
  };

  const startUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIsUploading(true);
    setError('');
    setProgress(0);
    try {
      const video = await uploadVideo(file, title.trim(), { onProgress: setProgress });
      toast.success(`"${video.title}" uploaded`);
      onUploaded(video);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-[#0e1628] border border-slate-700 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Upload video</h3>
          <button type="button" onClick={() => { if (!isUploading) { reset(); onOpenChange(false); } }} className="size-8 rounded-full bg-[#16213e] border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={startUpload} className="space-y-4">
          <label
            className={cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-[#131b31]/50 px-4 py-8 text-center transition-colors', isUploading && 'pointer-events-none opacity-60', file ? 'border-[#9bb3ff]' : 'border-slate-700 hover:border-slate-500')}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (!isUploading) pickFile(e.dataTransfer.files?.[0]); }}
          >
            <UploadCloud className="size-8 text-[#9bb3ff]" />
            {file ? (
              <><span className="text-sm font-medium text-white truncate max-w-full">{file.name}</span><span className="text-xs text-slate-400">{formatBytes(file.size)} · click to change</span></>
            ) : (
              <><span className="text-sm font-medium text-slate-200">Drop a video here, or click to choose</span><span className="text-xs text-slate-500">MP4, MOV, WebM…</span></>
            )}
            <input type="file" accept="video/*" className="sr-only" disabled={isUploading} onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>

          <div>
            <Label className="text-xs text-slate-300">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Event highlights" maxLength={200} disabled={isUploading} className="mt-1.5 h-10 bg-[#131b31] border-slate-700 text-white" />
          </div>

          {(isUploading || progress > 0) && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400"><span>{progress >= 100 ? 'Finishing…' : 'Uploading…'}</span><span>{progress}%</span></div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#9bb3ff] transition-[width] duration-200 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { if (!isUploading) { reset(); onOpenChange(false); } }} className="flex-1 rounded-full border border-slate-700 text-slate-300 hover:text-white py-2 text-xs font-medium cursor-pointer">Close</button>
            <button type="submit" disabled={!file || isUploading} className="flex-1 rounded-full bg-[#9bb3ff] hover:bg-[#88a3f8] text-[#0b1228] py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
              {isUploading ? <><Loader2 className="size-3.5 animate-spin" />Uploading…</> : <><UploadCloud className="size-3.5" />Upload</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VideosTable({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useMemo(() => readQuery(new URLSearchParams(searchParams.toString())), [searchParams]);
  const { settings, setSettings, realtime, screens } = useAdminData();

  const [data, setData] = useState<VideoListResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
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

  useEffect(() => {
    if (searchInput.trim() === query.q) return;
    const timeout = setTimeout(() => updateQuery({ q: searchInput.trim(), page: 1 }), 300);
    return () => clearTimeout(timeout);
  }, [searchInput, query.q, updateQuery]);

  useEffect(() => {
    const controller = new AbortController();
    fetchVideos(query, controller.signal)
      .then((result) => { setData(result); setLoadError(''); if (result.page > result.pageCount) updateQuery({ page: result.pageCount }); })
      .catch((err) => { if ((err as Error)?.name !== 'AbortError') setLoadError(err instanceof Error ? err.message : 'Failed to load videos'); })
      .finally(() => { if (!controller.signal.aborted) setSettledKey(requestKey); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightId]);

  const onSort = (field: VideoSortField) => {
    const order = query.sort === field ? (query.order === 'asc' ? 'desc' : 'asc') : field === 'title' || field === 'format' ? 'asc' : 'desc';
    updateQuery({ sort: field, order, page: 1 });
  };

  const onUploaded = (video: VideoRecord) => {
    setHighlightId(video.id);
    setReloadToken((t) => t + 1);
  };

  const onRenamed = (video: VideoRecord) =>
    setData((cur) => cur ? { ...cur, items: cur.items.map((item) => (item.id === video.id ? video : item)) } : cur);

  const screenIsShowingVideo = screens.some((s) => s.mode === 'video');
  const playOnBigScreen = useCallback(async (video: Pick<VideoRecord, 'id' | 'title'>) => {
    try {
      const saved = await updateDisplaySettings({ mode: 'video', videoId: video.id });
      setSettings(saved);
      toast.success(`"${video.title}" is now playing`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to play video');
    }
  }, [setSettings]);

  useChannelMessages(realtime, CHANNELS.content, (message) => {
    if (message.name !== 'video.created' && message.name !== 'video.deleted') return;
    setReloadToken((t) => t + 1);
    if (message.name === 'video.created' && screenIsShowingVideo) {
      const video = message.data as ContentEvents['video.created'];
      toast.info(`New video: "${video.title}"`, { action: { label: 'Play now', onClick: () => void playOnBigScreen(video) }, duration: 15000 });
    }
  });

  const copyLink = async (video: VideoRecord) => {
    try { await navigator.clipboard.writeText(video.url); toast.success('Link copied'); }
    catch { toast.error('Could not copy link'); }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteVideo(pendingDelete.id);
      if (result.clearedFromDisplay) setSettings((cur) => ({ ...cur, videoUrl: null, video: null }));
      toast.success(result.clearedFromDisplay ? 'Video deleted and removed from big screen' : 'Video deleted');
      setPendingDelete(null);
      setReloadToken((t) => t + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally { setIsDeleting(false); }
  };

  const isSelectedVideo = (video: VideoRecord) => (settings.video?.url ?? settings.videoUrl) === video.url;
  const isOnScreen = (video: VideoRecord) => isSelectedVideo(video) && settings.mode === 'video';

  const statusBadge = (video: VideoRecord) =>
    isOnScreen(video) ? (
      <Pill className="h-5 px-2 text-[10px]"><Dot tone="live" pulse className="size-1.5" /><MonitorPlay className="size-3" />On screen</Pill>
    ) : isSelectedVideo(video) ? (
      <Badge variant="soft" className="text-[10px]">Last played</Badge>
    ) : (
      <Badge variant="muted" className="text-[10px]">Library</Badge>
    );

  const rowActions = (video: VideoRecord) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" aria-label={`Actions for ${video.title}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setPreviewing(video)}><Play />Preview</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void playOnBigScreen(video)} disabled={isOnScreen(video)}><MonitorPlay />{isOnScreen(video) ? 'Playing on screen' : 'Play on big screen'}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(video.url, '_blank', 'noopener,noreferrer')}><ExternalLink />Open in new tab</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyLink(video)}><Copy />Copy link</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setRenaming(video)}><Pencil />Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(video)}><Trash2 />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const items = data?.items ?? [];

  return (
    <>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete video?"
        description={pendingDelete ? `"${pendingDelete.title}" will be permanently deleted.${isSelectedVideo(pendingDelete) ? ' It is the current big-screen video.' : ''}` : ''}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
      <VideoPreviewDialog video={previewing} onClose={() => setPreviewing(null)} />
      <RenameDialog video={renaming} onClose={() => setRenaming(null)} onRenamed={onRenamed} />
      <UploadSheet open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={onUploaded} />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 size-4 text-slate-500" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search videos…"
            className="w-full bg-[#131b31] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9bb3ff]/50"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {isLoading && data && <Loader2 className="size-4 animate-spin" />}
          {data && <span>{data.total} video{data.total === 1 ? '' : 's'}</span>}
        </div>
      </div>

      {/* Body */}
      <div className="modal-scrollbar-hidden min-h-0 flex-1 overflow-auto">
        {loadError && !data ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <AlertCircle className="size-10 mb-3 opacity-40" />
            <p className="font-medium">Couldn&apos;t load videos</p>
            <p className="text-xs mt-1">{loadError}</p>
            <button onClick={() => setReloadToken((t) => t + 1)} className="mt-4 rounded-full border border-slate-700 text-slate-300 px-4 py-2 text-xs cursor-pointer hover:text-white">Try again</button>
          </div>
        ) : !data ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="aspect-video w-20 bg-slate-800" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3 bg-slate-800" /><Skeleton className="h-3 w-1/5 bg-slate-800" /></div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Film className="size-10 mb-3 opacity-40" />
            <p className="font-medium">{query.q ? 'No videos match your search' : 'No videos yet'}</p>
            <p className="text-xs mt-1">{query.q ? 'Try a different search.' : 'Upload a video to get started.'}</p>
            {!query.q && (
              <button onClick={() => setUploadOpen(true)} className="mt-4 rounded-full bg-[#9bb3ff] text-[#0b1228] px-5 py-2 text-xs font-semibold cursor-pointer flex items-center gap-2">
                <UploadCloud className="size-3.5" />Upload video
              </button>
            )}
          </div>
        ) : (
          <div className={cn('transition-opacity', isLoading && 'opacity-60')}>
            {/* Mobile */}
            <ul className="divide-y divide-slate-800/60 md:hidden">
              {items.map((video) => (
                <li key={video.id} className={cn('flex gap-3 p-4', highlightId === video.id && 'bg-[#1a2544]/50')}>
                  <VideoThumbnail video={video} onClick={() => setPreviewing(video)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{video.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDuration(video.duration)} · {formatBytes(video.bytes)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {statusBadge(video)}
                      <span className="text-xs text-slate-500">{formatDay(video.createdAt)}</span>
                    </div>
                  </div>
                  {rowActions(video)}
                </li>
              ))}
            </ul>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-[#0a1221] border-b border-slate-800 z-10">
                  <tr className="text-left text-[11px] font-medium text-slate-400">
                    <SortableHeader field="title" label="Video" query={query} onSort={onSort} />
                    <SortableHeader field="bytes" label="Size" query={query} onSort={onSort} className="text-right" />
                    <SortableHeader field="createdAt" label="Uploaded" query={query} onSort={onSort} />
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="w-14 px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((video) => (
                    <tr key={video.id} className={cn('hover:bg-slate-800/30 transition-colors', highlightId === video.id && 'bg-[#1a2544]/50')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <VideoThumbnail video={video} onClick={() => setPreviewing(video)} />
                          <div>
                            <p className="text-sm font-semibold text-white truncate max-w-56" title={video.title}>{video.title}</p>
                            <p className="text-[11px] text-slate-500 truncate max-w-56">{video.publicId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-300 whitespace-nowrap tabular-nums">{formatBytes(video.bytes)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs text-white">{formatDay(video.createdAt)}</p>
                        <p className="text-[11px] text-slate-400">{formatTime(video.createdAt)}</p>
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
      </div>

      {data && data.total > 0 && (
        <div className="shrink-0 border-t border-slate-800">
          <Pagination data={data} onPage={(page) => updateQuery({ page })} onPageSize={(pageSize) => updateQuery({ pageSize, page: 1 })} />
        </div>
      )}
    </>
  );
}

export function VideosDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Videos library"
      className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-hidden bg-black/75 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div className="theme-tr theme-admin relative flex h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700/80 bg-[#0e1628] shadow-2xl sm:h-[min(88dvh,52rem)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Videos</h2>
            <p className="text-xs text-slate-400 mt-0.5">Played when the big screen is in Video mode</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="size-8 rounded-full bg-[#16213e] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#223158] transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Real Videos table with real data */}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading…</div>}>
          <VideosTable onClose={() => onOpenChange(false)} />
        </Suspense>
      </div>
    </div>
  );
}
