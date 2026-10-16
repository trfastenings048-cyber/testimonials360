'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, EyeOff, ImagePlus, Images, MonitorPlay } from 'lucide-react';
import type { EventImage } from '@/types';
import { Button } from '@/components/ui/button';
import { useAdminData } from './AdminDataProvider';
import { PageHeader } from './PageHeader';
import { StatCard } from './StatCard';
import { ContentLibraryTable } from './overview/ContentLibraryTable';
import { getImageStatuses, timeAgo } from './overview/imageStatus';
import { UploadImageDialog } from './overview/UploadImageDialog';

/** How long a just-uploaded row stays highlighted in the table. */
const HIGHLIGHT_MS = 3000;

export function OverviewPage() {
  const { images, setImages, imagesLoading } = useAdminData();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);

  // "U" opens the upload dialog unless the admin is typing somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'u' && event.key !== 'U') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      setUploadOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  const onUploaded = useCallback(
    (image: EventImage) => {
      // The realtime `image.updated` event may have added it already.
      setImages((prev) => [image, ...prev.filter((item) => item.id !== image.id)]);
      setHighlightId(image.id);
      window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    },
    [setImages]
  );

  const stats = useMemo(() => {
    let onScreen = 0;
    let hidden = 0;
    getImageStatuses(images).forEach(({ status }) => {
      if (status === 'on-screen') onScreen += 1;
      if (status === 'hidden') hidden += 1;
    });
    const latest = images.reduce<EventImage | null>(
      (newest, image) => (!newest || image.timestamp > newest.timestamp ? image : newest),
      null
    );
    return { onScreen, hidden, latest };
  }, [images]);

  const pending = imagesLoading ? '—' : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace overview"
        title="Overview"
        description="Upload, organise and control the group photos shown on the event display."
        actions={
          <Button className="h-10 gap-2 px-5" onClick={() => setUploadOpen(true)} aria-keyshortcuts="U">
            <ImagePlus /> Upload new content
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          tone="signature"
          label="On the big screen"
          value={pending ?? stats.onScreen}
          hint={`group${stats.onScreen === 1 ? '' : 's'} rotating now`}
          icon={<MonitorPlay />}
        />
        <StatCard label="Total photos" value={pending ?? images.length} icon={<Images />} />
        <StatCard label="Hidden" value={pending ?? stats.hidden} icon={<EyeOff />} />
        <StatCard
          label="Last upload"
          value={
            <span className="block truncate text-2xl leading-10">
              {stats.latest ? timeAgo(stats.latest.timestamp) : (pending ?? 'None yet')}
            </span>
          }
          hint={stats.latest ? <span className="block truncate">{stats.latest.groupName}</span> : undefined}
          icon={<Clock />}
        />
      </div>

      <ContentLibraryTable
        images={images}
        setImages={setImages}
        loading={imagesLoading}
        highlightId={highlightId}
        onUploadClick={() => setUploadOpen(true)}
      />

      <UploadImageDialog open={uploadOpen} onOpenChange={setUploadOpen} images={images} onUploaded={onUploaded} />
    </div>
  );
}
