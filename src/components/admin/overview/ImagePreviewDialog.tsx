'use client';

import { useEffect } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronLeft, ChevronRight, Download, Eye, EyeOff, Loader2, Trash2, X } from 'lucide-react';
import { imageSrc } from '@/lib/image-urls';
import type { EventImage } from '@/types';
import { BlurFillImage } from '@/components/display/BlurFillImage';
import { CounterChip } from '@/components/shared/CounterChip';
import { Button } from '@/components/ui/button';
import type { ImageStatusInfo } from './imageStatus';
import { formatDay, formatTime, ImageStatusPill } from './ImageStatusPill';

const roundButton =
  'surface-shadow flex size-10 items-center justify-center rounded-full bg-white text-ink transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40';

/** Full-size photo, framed like the big screen; ←/→ step through the table's current rows. */
export function ImagePreviewDialog({
  images,
  index,
  onIndexChange,
  statusOf,
  busy,
  onToggleVisibility,
  onDownload,
  onDelete,
}: {
  images: EventImage[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  statusOf: (image: EventImage) => ImageStatusInfo;
  busy: boolean;
  onToggleVisibility: (image: EventImage) => void;
  onDownload: (image: EventImage) => void;
  onDelete: (image: EventImage) => void;
}) {
  const image = index !== null ? images[index] : undefined;
  const open = Boolean(image);
  const count = images.length;

  useEffect(() => {
    if (!open || index === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (event.key === 'ArrowRight' && index < count - 1) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, index, count, onIndexChange]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[190] bg-ink/60 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[191] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-[min(90vw,1200px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-ink text-white shadow-2xl outline-none transition-all duration-200 data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
          {image && index !== null && (
            <>
              <div className="relative aspect-video max-h-[72vh] w-full overflow-hidden bg-ink">
                <BlurFillImage key={image.id} src={imageSrc(image, 'full')} alt={`${image.groupName} group`} />

                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                  <CounterChip index={index} count={count} className="surface-shadow bg-white text-xs text-ink" />
                  <Dialog.Close className={roundButton} aria-label="Close preview">
                    <X className="size-4" />
                  </Dialog.Close>
                </div>

                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => onIndexChange(index - 1)}
                    aria-label="Previous photo"
                    className={`${roundButton} absolute top-1/2 left-4 -translate-y-1/2`}
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                )}
                {index < count - 1 && (
                  <button
                    type="button"
                    onClick={() => onIndexChange(index + 1)}
                    aria-label="Next photo"
                    className={`${roundButton} absolute top-1/2 right-4 -translate-y-1/2`}
                  >
                    <ChevronRight className="size-5" />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0">
                    <Dialog.Title className="truncate text-lg leading-6 font-normal">{image.groupName}</Dialog.Title>
                    <Dialog.Description className="font-display-mono text-xs text-white/60">
                      Uploaded {formatDay(image.timestamp)} {formatTime(image.timestamp)}
                    </Dialog.Description>
                  </div>
                  <ImageStatusPill info={statusOf(image)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="h-9 gap-1.5 px-4" disabled={busy} onClick={() => onToggleVisibility(image)}>
                    {busy ? <Loader2 className="animate-spin" /> : image.isVisible ? <EyeOff /> : <Eye />}
                    {image.isVisible ? 'Hide' : 'Show'}
                  </Button>
                  <Button variant="secondary" className="h-9 gap-1.5 px-4" disabled={busy} onClick={() => onDownload(image)}>
                    <Download /> Download
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 gap-1.5 px-4 text-destructive"
                    onClick={() => onDelete(image)}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
