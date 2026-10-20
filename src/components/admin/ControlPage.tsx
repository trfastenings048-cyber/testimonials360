'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Loader2,
  SkipBack,
  SkipForward,
  MessageSquareQuote,
  MonitorOff,
  Pause,
  Play,
  VolumeX,
} from 'lucide-react';
import { fetchVideos, updateDisplaySettings, type DisplaySettings, type VideoRecord } from '@/lib/api';
import { CHANNELS, type CommandName, type ContentEvents } from '@/lib/realtime/protocol';
import { useChannelMessages } from '@/lib/realtime/client';
import { cn } from '@/lib/utils';
import { CounterChip } from '@/components/shared/CounterChip';
import { useAdminData } from './AdminDataProvider';

/** Large, touch-friendly control: icon on top, label underneath. */
function ControlButton({
  icon,
  label,
  hint,
  onClick,
  active = false,
  tone = 'neutral',
  disabled = false,
  ariaLabel,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  active?: boolean;
  tone?: 'neutral' | 'primary' | 'accent';
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={tone === 'primary' ? active : undefined}
      className={cn(
        'flex h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl px-2 text-sm font-medium outline-none transition-all active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-45 sm:h-[76px] [&_svg]:size-5 sm:[&_svg]:size-6',
        tone === 'primary' &&
          (active
            ? 'bg-ink text-white shadow-lg shadow-ink/25'
            : 'surface-shadow bg-card text-ink hover:bg-accent-blue-soft'),
        tone === 'accent' && 'bg-ink text-white shadow-lg shadow-ink/25 hover:bg-ink/90',
        tone === 'neutral' &&
          (active
            ? 'bg-accent-blue-soft text-ink ring-1 ring-accent-blue/40'
            : 'surface-shadow bg-card text-ink hover:bg-accent-blue-soft')
      )}
    >
      {icon}
      <span>{label}</span>
      {hint && <span className="max-w-full truncate text-[11px] font-normal opacity-70">{hint}</span>}
    </button>
  );
}

export function ControlPage() {
  const { settings, setSettings, screens, connection, realtime, publishCommand } = useAdminData();
  const [savingMode, setSavingMode] = useState<DisplaySettings['mode'] | null>(null);
  const [pendingCommand, setPendingCommand] = useState<CommandName | null>(null);
  const [latestVideo, setLatestVideo] = useState<VideoRecord | null>(null);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [partCount, setPartCount] = useState<number | null>(null);
  const [savingSet, setSavingSet] = useState<'single' | 'parts' | null>(null);

  // One read to know what "Video" will play; uploads and deletes then arrive over Ably.
  useEffect(() => {
    fetchVideos({ page: 1, pageSize: 10, sort: 'createdAt', order: 'desc', q: '', standalone: true })
      .then((result) => setLatestVideo(result.items[0] ?? null))
      .catch(() => setLatestVideo(null))
      .finally(() => setVideosLoaded(true));
    fetchVideos({ page: 1, pageSize: 10, sort: 'createdAt', order: 'desc', q: '', set: 'parts' })
      .then((result) => setPartCount(result.total))
      .catch(() => setPartCount(0));
  }, []);

  useChannelMessages(realtime, CHANNELS.content, (message) => {
    if (message.name === 'video.created') {
      const created = message.data as VideoRecord;
      if (created.setName) setPartCount((count) => (count ?? 0) + 1);
      else setLatestVideo(created);
    } else if (message.name === 'video.deleted') {
      const { id } = message.data as ContentEvents['video.deleted'];
      fetchVideos({ page: 1, pageSize: 10, sort: 'createdAt', order: 'desc', q: '', set: 'parts' })
        .then((result) => setPartCount(result.total))
        .catch(() => undefined);
      if (latestVideo?.id === id) {
        fetchVideos({ page: 1, pageSize: 10, sort: 'createdAt', order: 'desc', q: '', standalone: true })
          .then((result) => setLatestVideo(result.items[0] ?? null))
          .catch(() => setLatestVideo(null));
      }
    }
  });

  const screen = screens[0];
  const hasScreen = Boolean(screen);
  const liveMode = screen?.mode ?? settings.mode;
  const isVideo = liveMode === 'video';
  const currentVideoTitle = screen?.video.title ?? settings.video?.title ?? null;
  const currentVideoUrl = settings.video?.url ?? settings.videoUrl ?? null;
  const activeSet = screen?.video.set ?? settings.videoSet ?? 'single';
  const newerVideoAvailable = isVideo && activeSet === 'single' && latestVideo && latestVideo.url !== currentVideoUrl;

  const changeDisplayMode = async (mode: DisplaySettings['mode']) => {
    // Re-pressing Video while a newer upload exists switches to that upload.
    if (mode === liveMode && !(mode === 'video' && newerVideoAvailable)) return;
    setSavingMode(mode);
    try {
      const saved = await updateDisplaySettings(mode === 'video' ? { mode, videoSet: activeSet } : { mode });
      setSettings(saved);
      toast.success(
        mode === 'video' ? `Playing "${saved.video?.title ?? 'video'}" on the big screen` : 'Big screen switched to Testimonials'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch display mode');
    } finally {
      setSavingMode(null);
    }
  };

  const changeVideoSet = async (videoSet: 'single' | 'parts') => {
    if (videoSet === activeSet && isVideo) return;
    setSavingSet(videoSet);
    try {
      const saved = await updateDisplaySettings({ mode: 'video', videoSet });
      setSettings(saved);
      toast.success(videoSet === 'parts' ? `Playing Video 2 (${saved.playlist?.length ?? 0} parts)` : `Playing "${saved.video?.title ?? 'Video 1'}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch video');
    } finally {
      setSavingSet(null);
    }
  };

  const send = async (command: CommandName) => {
    setPendingCommand(command);
    try {
      await publishCommand(command);
    } catch {
      toast.error('Could not reach the big screen. Check the connection and try again.');
    } finally {
      // The label itself updates when the screen reports its new state via presence.
      window.setTimeout(() => setPendingCommand((current) => (current === command ? null : current)), 600);
    }
  };

  const commandIcon = (command: CommandName, icon: ReactNode) =>
    pendingCommand === command ? <Loader2 className="animate-spin" /> : icon;

  const testimonialsPaused = screen?.testimonials.paused ?? false;

  const videoPlaying = screen?.video.playing ?? false;
  const clipCount = screen?.video.count ?? 0;
  const clipIndex = screen?.video.index ?? 0;
  const playbackDisabled = !hasScreen || connection !== 'live';

  const testimonialStatus = !screen
    ? null
    : screen.testimonials.count === 0
      ? 'No approved testimonials yet'
      : testimonialsPaused
        ? `Paused on ${Math.min(screen.testimonials.index + 1, screen.testimonials.count)} of ${screen.testimonials.count}`
        : `Auto-rotating · ${screen.testimonials.count} testimonial${screen.testimonials.count === 1 ? '' : 's'}`;

  const banner = screen?.banner;
  const bannerPaused = banner?.paused ?? false;
  const bannerStatus = !screen
    ? null
    : !banner
      ? 'Reload the big screen to enable banner controls'
      : banner.count === 0
        ? 'No group photos on screen yet'
        : bannerPaused
          ? `Paused on ${banner.groupName ? `“${banner.groupName}” ` : ''}(${Math.min(banner.index + 1, banner.count)} of ${banner.count})`
          : `Auto-playing · ${banner.count} group photo${banner.count === 1 ? '' : 's'}`;

  /** One labelled Left / Pause-Play / Right row for a slideshow on the screen. */
  const playbackRow = ({
    id,
    title,
    status,
    paused,
    position,
    commands,
    noun,
    disabled,
  }: {
    id: string;
    title: string;
    status: string | null;
    paused: boolean;
    position: { index: number; count: number } | null;
    commands: { previous: CommandName; next: CommandName; play: CommandName; pause: CommandName };
    noun: string;
    disabled: boolean;
  }) => (
    <section className="admin-card mt-4 w-full p-4" aria-labelledby={`${id}-heading`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-eyebrow text-muted-foreground">
          {title}
        </h2>
        {position && position.count > 0 && (
          <CounterChip index={position.index} count={position.count} className="text-[11px]" />
        )}
      </div>
      <p className="mt-1 mb-3 min-h-5 truncate text-left text-sm font-medium text-ink" aria-live="polite">
        {status}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <ControlButton
          disabled={disabled}
          onClick={() => void send(commands.previous)}
          icon={commandIcon(commands.previous, <ChevronLeft />)}
          label="Left"
          ariaLabel={`Previous ${noun}`}
        />
        <ControlButton
          tone="accent"
          disabled={disabled}
          onClick={() => void send(paused ? commands.play : commands.pause)}
          icon={commandIcon(paused ? commands.play : commands.pause, paused ? <Play /> : <Pause />)}
          label={paused ? 'Play' : 'Pause'}
          ariaLabel={`${paused ? 'Resume' : 'Pause'} ${noun}s`}
        />
        <ControlButton
          disabled={disabled}
          onClick={() => void send(commands.next)}
          icon={commandIcon(commands.next, <ChevronRight />)}
          label="Right"
          ariaLabel={`Next ${noun}`}
        />
      </div>
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center py-2 text-center sm:py-4">
      <p className="text-eyebrow text-muted-foreground">Live control</p>
      <h1 className="mt-1 text-xl font-normal tracking-tight text-ink sm:text-2xl">Control the Testimonials Display page</h1>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        Choose what the big screen shows, then control playback. Changes reach every connected screen instantly.
      </p>

      {!hasScreen && (
        <div className="mt-4 flex w-full items-start gap-3 rounded-2xl border border-warning/25 bg-warning/10 p-3 text-left text-xs text-warning">
          <MonitorOff className="size-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-medium">No big screen is connected.</span> Open{' '}
            <Link href="/display" target="_blank" className="font-medium underline underline-offset-2">
              /display
            </Link>{' '}
            on the screen; playback controls turn on as soon as it connects.
          </p>
        </div>
      )}
      {screens.length > 1 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {screens.length} screens connected. Commands go to all of them; status shows the first.
        </p>
      )}

      {/* Mode */}
      <section className="mt-6 w-full" aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="mb-2 text-eyebrow text-muted-foreground">
          Screen mode
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <ControlButton
            tone="primary"
            active={!isVideo}
            disabled={savingMode !== null}
            onClick={() => void changeDisplayMode('testimonials')}
            icon={savingMode === 'testimonials' ? <Loader2 className="animate-spin" /> : <MessageSquareQuote />}
            label="Testimonials"
          />
          <ControlButton
            tone="primary"
            active={isVideo}
            disabled={savingMode !== null || (videosLoaded && !latestVideo)}
            onClick={() => void changeDisplayMode('video')}
            icon={savingMode === 'video' ? <Loader2 className="animate-spin" /> : <Film />}
            label={newerVideoAvailable ? 'Play latest video' : 'Video'}
            hint={latestVideo ? `Latest: ${latestVideo.title}` : videosLoaded ? 'No videos uploaded' : undefined}
          />
        </div>
        {videosLoaded && !latestVideo && (
          <p className="mt-2 text-xs text-muted-foreground">
            <Link href="/admin/videos" className="font-medium text-accent-blue-strong underline underline-offset-2">
              Upload a video
            </Link>{' '}
            to use Video mode.
          </p>
        )}
      </section>

      {/* Playback */}
      {isVideo ? (
        <section className="admin-card mt-4 w-full p-4" aria-labelledby="video-playback-heading">
          <h2 id="video-playback-heading" className="text-eyebrow text-muted-foreground">
            Video playback
          </h2>
          <p className="mt-1 mb-3 min-h-5 truncate text-left text-sm font-medium text-ink" aria-live="polite">
            {currentVideoTitle ? `${videoPlaying ? 'Now playing' : 'Paused'}: ${currentVideoTitle}` : 'No video selected'}
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:gap-3" role="group" aria-label="Which video to play">
            <ControlButton
              tone="primary"
              active={activeSet === 'single'}
              disabled={savingSet !== null || (videosLoaded && !latestVideo)}
              onClick={() => void changeVideoSet('single')}
              icon={savingSet === 'single' ? <Loader2 className="animate-spin" /> : <Film />}
              label="Video 1"
              hint={latestVideo?.title ?? (videosLoaded ? 'No video uploaded' : undefined)}
            />
            <ControlButton
              tone="primary"
              active={activeSet === 'parts'}
              disabled={savingSet !== null || !partCount}
              onClick={() => void changeVideoSet('parts')}
              icon={savingSet === 'parts' ? <Loader2 className="animate-spin" /> : <Film />}
              label="Video 2"
              hint={partCount ? `${partCount} short parts` : partCount === 0 ? 'Parts not uploaded' : undefined}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <ControlButton
              tone={videoPlaying ? 'neutral' : 'accent'}
              active={videoPlaying}
              disabled={playbackDisabled}
              onClick={() => void send('video.play')}
              icon={commandIcon('video.play', <Play />)}
              label={videoPlaying ? 'Playing' : 'Play'}
              ariaLabel="Play video"
            />
            <ControlButton
              tone={videoPlaying ? 'accent' : 'neutral'}
              active={hasScreen && !videoPlaying}
              disabled={playbackDisabled}
              onClick={() => void send('video.pause')}
              icon={commandIcon('video.pause', <Pause />)}
              label={hasScreen && !videoPlaying ? 'Paused' : 'Pause'}
              ariaLabel="Pause video"
            />
          </div>
          {clipCount > 1 && (
            <div className="mt-3">
              <p className="mb-2 text-left text-sm font-medium text-ink" aria-live="polite">
                Part {Math.min(clipIndex + 1, clipCount)} of {clipCount}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <ControlButton
                  disabled={playbackDisabled}
                  onClick={() => void send('video.previous')}
                  icon={commandIcon('video.previous', <SkipBack />)}
                  label="Previous part"
                  ariaLabel="Previous video part"
                />
                <ControlButton
                  disabled={playbackDisabled}
                  onClick={() => void send('video.next')}
                  icon={commandIcon('video.next', <SkipForward />)}
                  label="Next part"
                  ariaLabel="Next video part"
                />
              </div>
            </div>
          )}
          {screen && !screen.audioUnlocked && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl border border-warning/25 bg-warning/10 px-3 py-2 text-left text-xs text-warning">
              <VolumeX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              The screen plays muted until someone taps it once (a browser autoplay rule). Tap the big screen to turn on
              sound.
            </p>
          )}
        </section>
      ) : (
        <>
          {playbackRow({
            id: 'testimonial-playback',
            title: 'Testimonial card',
            status: testimonialStatus,
            paused: testimonialsPaused,
            position: screen ? { index: screen.testimonials.index, count: screen.testimonials.count } : null,
            commands: { previous: 'testimonials.previous', next: 'testimonials.next', play: 'testimonials.play', pause: 'testimonials.pause' },
            noun: 'testimonial',
            disabled: playbackDisabled,
          })}
          {playbackRow({
            id: 'banner-playback',
            title: 'Group photo banner',
            status: bannerStatus,
            paused: bannerPaused,
            position: banner ? { index: banner.index, count: banner.count } : null,
            commands: { previous: 'banner.previous', next: 'banner.next', play: 'banner.play', pause: 'banner.pause' },
            noun: 'group photo',
            // A screen still running an older build doesn't understand banner commands yet.
            disabled: playbackDisabled || !screen?.banner,
          })}
        </>
      )}
    </div>
  );
}
