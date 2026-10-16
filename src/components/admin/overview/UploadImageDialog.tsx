'use client';

import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { toast } from 'sonner';
import { AlertCircle, AlertTriangle, ImagePlus, Info, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { uploadImageToDB } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EventImage } from '@/types';
import { Arches } from '@/components/shared/Arches';
import { BlurFillImage } from '@/components/display/BlurFillImage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatBytes, groupNameImpact } from './imageStatus';

const KEEP_OPEN_KEY = 'tr-admin-upload-keep-open';
/** Not a hard limit (Cloudinary decides); just a heads-up for slow event Wi-Fi. */
const LARGE_FILE_BYTES = 20 * 1024 * 1024;
const MAX_GROUP_NAME = 120;

type Picked = { file: File; url: string; width?: number; height?: number };

const readKeepOpen = () => {
  try {
    return localStorage.getItem(KEEP_OPEN_KEY) === '1';
  } catch {
    return false;
  }
};

export function UploadImageDialog({
  open,
  onOpenChange,
  images,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: EventImage[];
  onUploaded: (image: EventImage) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const groupListId = useId();
  const groupInputId = useId();

  const [picked, setPicked] = useState<Picked | null>(null);
  const [groupName, setGroupName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(readKeepOpen);
  const [confirmClose, setConfirmClose] = useState(false);

  const groupNames = useMemo(
    () =>
      [...new Map(images.map((image) => [image.groupName.trim().toLowerCase(), image.groupName.trim()])).values()]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    [images]
  );
  const impact = groupNameImpact(images, groupName);
  const trimmedName = groupName.trim();

  // Object URLs are revoked whenever the picked file changes or the dialog unmounts.
  const pickedUrl = picked?.url;
  useEffect(() => () => (pickedUrl ? URL.revokeObjectURL(pickedUrl) : undefined), [pickedUrl]);

  const pickFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError("That's not an image. Choose a JPG, PNG, WebP or HEIC photo.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setPicked({ file, url });
    const probe = new window.Image();
    probe.onload = () =>
      setPicked((current) => (current?.url === url ? { ...current, width: probe.naturalWidth, height: probe.naturalHeight } : current));
    probe.src = url;
    window.setTimeout(() => groupInputRef.current?.focus(), 0);
  };

  // Paste a photo straight from the clipboard while the dialog is open.
  useEffect(() => {
    if (!open || isUploading) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'));
      if (file) {
        event.preventDefault();
        pickFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, isUploading]);

  const reset = () => {
    setPicked(null);
    setGroupName('');
    setProgress(0);
    setError(null);
    setIsDragging(false);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const requestClose = () => {
    if (isUploading) setConfirmClose(true);
    else close();
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isUploading) pickFile(event.dataTransfer.files?.[0]);
  };

  const toggleKeepOpen = (value: boolean) => {
    setKeepOpen(value);
    try {
      localStorage.setItem(KEEP_OPEN_KEY, value ? '1' : '0');
    } catch {
      // Preference just won't persist.
    }
  };

  const upload = async () => {
    if (!picked || !trimmedName || isUploading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsUploading(true);
    setProgress(0);
    setError(null);
    try {
      // Goes straight to Cloudinary, so photos larger than Vercel's 4.5 MB body limit work.
      const image = await uploadImageToDB(picked.file, trimmedName, { onProgress: setProgress, signal: controller.signal });
      onUploaded(image);
      toast.success(`${image.groupName} is on the big screen`);
      if (keepOpen) {
        reset();
      } else {
        close();
      }
    } catch (uploadError) {
      if (controller.signal.aborted) {
        toast('Upload cancelled');
      } else {
        setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Try again.');
      }
    } finally {
      abortRef.current = null;
      setIsUploading(false);
    }
  };

  const cancelUpload = () => abortRef.current?.abort();

  const isLarge = picked && picked.file.size > LARGE_FILE_BYTES;

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[190] bg-ink/40 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup
            className="surface-card fixed top-1/2 left-1/2 z-[191] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] text-foreground outline-none transition-all duration-200 data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100"
            onDragOver={(event) => {
              event.preventDefault();
              if (!isUploading) setIsDragging(true);
            }}
            onDrop={onDrop}
          >
            {/* Header band: the big screen's signature gradient */}
            <div className="bg-signature relative shrink-0 overflow-hidden px-6 pt-6 pb-5">
              <Arches className="text-white/60" />
              <div className="relative flex items-start gap-3 pr-10">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                  <Upload className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <Dialog.Title className="text-xl leading-7 font-normal text-ink">Upload new content</Dialog.Title>
                  <Dialog.Description className="text-[13px] text-ink/75">
                    The photo appears on the big screen straight away.
                  </Dialog.Description>
                </div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="surface-shadow absolute top-5 right-5 flex size-9 items-center justify-center rounded-full bg-white text-ink transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                void upload();
              }}
            >
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    pickFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />

                {picked ? (
                  <div className="space-y-2">
                    <div className="relative aspect-video overflow-hidden rounded-[20px] bg-surface-page">
                      <BlurFillImage src={picked.url} alt="Selected photo preview" />
                      {!isUploading && (
                        <div className="absolute right-3 bottom-3 flex gap-2">
                          <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <RefreshCw /> Replace
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setPicked(null)}>
                            <X /> Remove
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="truncate font-display-mono text-xs text-muted-foreground">
                      {picked.file.name} · {formatBytes(picked.file.size)}
                      {picked.width && picked.height ? ` · ${picked.width}×${picked.height}` : ''}
                    </p>
                    {isLarge && (
                      <p className="flex items-center gap-1.5 text-xs text-warning">
                        <Info className="size-3.5 shrink-0" aria-hidden="true" />
                        Large file: this may take a while on event Wi-Fi.
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragLeave={() => setIsDragging(false)}
                    className={cn(
                      'flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-4 py-10 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isDragging
                        ? 'border-accent-blue bg-accent-blue-soft'
                        : 'border-border bg-surface-page/50 hover:border-accent-blue/60 hover:bg-accent-blue-soft/60'
                    )}
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-white text-accent-blue-strong surface-shadow">
                      <ImagePlus className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-ink">Drop a photo here, paste it, or click to choose</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG, WebP or HEIC</span>
                  </button>
                )}

                <div className="space-y-2">
                  <Label htmlFor={groupInputId}>Group name</Label>
                  <Input
                    ref={groupInputRef}
                    id={groupInputId}
                    list={groupListId}
                    value={groupName}
                    maxLength={MAX_GROUP_NAME}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="e.g. Group A, Stage 1"
                    autoComplete="off"
                    disabled={isUploading}
                    required
                    className="h-11"
                  />
                  <datalist id={groupListId}>
                    {groupNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {impact === 'replaces' && (
                    <p className="flex items-start gap-1.5 rounded-2xl border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
                      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        “{trimmedName}” is on screen now. This photo will replace it.
                      </span>
                    </p>
                  )}
                  {impact === 'joins-hidden' && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                      Adds to the hidden group “{trimmedName}”; this photo will show on screen.
                    </p>
                  )}
                </div>

                {isUploading && (
                  <div className="space-y-1.5" aria-live="polite">
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
                    <p className="flex justify-between text-xs text-muted-foreground">
                      <span>Uploading…</span>
                      <span className="font-display-mono tabular-nums">{progress}%</span>
                    </p>
                  </div>
                )}

                {error && (
                  <p role="alert" className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {error}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                  <Checkbox checked={keepOpen} onCheckedChange={(value) => toggleKeepOpen(Boolean(value))} />
                  Keep open for the next photo
                </label>
                <div className="flex gap-2">
                  {isUploading ? (
                    <Button type="button" variant="secondary" className="h-10 px-4" onClick={cancelUpload}>
                      Cancel upload
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" className="h-10 px-4" onClick={close}>
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" className="h-10 gap-2 px-5" disabled={!picked || !trimmedName || isUploading}>
                    {isUploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                    {isUploading ? 'Uploading…' : 'Upload photo'}
                  </Button>
                </div>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={confirmClose}
        title="Stop this upload?"
        description="The photo is still uploading. Closing now cancels it."
        confirmLabel="Stop and close"
        cancelLabel="Keep uploading"
        onConfirm={() => {
          setConfirmClose(false);
          cancelUpload();
          close();
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  );
}
