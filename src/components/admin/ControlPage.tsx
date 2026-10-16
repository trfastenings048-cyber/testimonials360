'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Loader2,
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
        'flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 px-2 text-base font-semibold shadow-sm outline-none transition-all active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-45 sm:h-32 sm:text-lg [&_svg]:size-9 sm:[&_svg]:size-10',
        tone === 'primary' &&
          (active
            ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25'
            : 'border-border bg-background text-primary hover:border-primary/40 hover:bg-primary/5'),
        tone === 'accent' &&
          'border-secondary bg-secondary text-secondary-foreground shadow-lg shadow-secondary/25 hover:bg-brand-teal-hover',
        tone === 'neutral' &&
          (active
            ? 'border-secondary bg-accent text-primary'
            : 'border-border bg-background text-primary hover:border-secondary hover:bg-accent')
      )}
    >
      {icon}
      <span>{label}</span>
      {hint && <span className="max-w-full truncate text-xs font-medium opacity-70">{hint}</span>}
    </button>
  );
}

export function ControlPage() {
  const { settings, setSettings, screens, connection, realtime, publishCommand } = useAdminData();
  const [savingMode, setSavingMode] = useState<DisplaySettings['mode'] | null>(null);
  const [pendingCommand, setPendingCommand] = useState<CommandName | null>(null);
  const [latestVideo, setLatestVideo] = useState<VideoRecord | null>(null);
  const [videosLoaded, setVideosLoaded] = useState(false);

  // One read to know what "Video" will play; uploads and deletes then arrive over Ably.
  useEffect(() => {
    fetchVideos({ page: 1, pageSize: 10, sort: 'createdAt', order: 'desc', q: '' })
      .then((result) => setLatestVideo(result.items[0] ?? null))
      .catch(() => setLatestVideo(null))
      .finally(() => setVideosLoaded(true));
  }, []);

  useChannelMessages(realtime, CHANNELS.content, (message) => {
    if (message.name === 'video.created') {
      setLatestVideo(message.data as VideoRecord);
    } else if (message.name === 'video.deleted') {
      const { id } = message.data as ContentEvents['video.deleted'];
      if (latestVideo?.id === id) {
        fetchVideos({ page: 1, pageSize: 10, sort: 'createdAt', order: 'desc', q: '' })
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
  const newerVideoAvailable = isVideo && latestVideo && latestVideo.url !== currentVideoUrl;

  const changeDisplayMode = async (mode: DisplaySettings['mode']) => {
    // Re-pressing Video while a newer upload exists switches to that upload.
    if (mode === liveMode && !(mode === 'video' && newerVideoAvailable)) return;
    setSavingMode(mode);
    try {
      const saved = await updateDisplaySettings({ mode });
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
    commands,
    noun,
    disabled,
  }: {
    id: string;
    title: string;
    status: string | null;
    paused: boolean;
    commands: { previous: CommandName; next: CommandName; play: CommandName; pause: CommandName };
    noun: string;
    disabled: boolean;
  }) => (
    <section className="admin-card mt-6 w-full p-4 sm:p-6" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-eyebrow text-muted-foreground">
        {title}
      </h2>
      <p className="mt-1 mb-4 min-h-5 truncate text-sm font-medium text-foreground" aria-live="polite">
        {status}
      </p>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
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
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center py-2 text-center sm:py-6">
      <p className="text-eyebrow text-secondary">Live control</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
        Control the Testimonials Display page
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Choose what the big screen shows, then control playback. Changes reach every connected screen instantly.
      </p>

      {!hasScreen && (
        <div className="mt-6 flex w-full items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-left text-sm text-warning">
          <MonitorOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">No big screen is connected.</span> Open{' '}
            <Link href="/display" target="_blank" className="font-semibold underline underline-offset-2">
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
      <section className="mt-8 w-full" aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="mb-3 text-eyebrow text-muted-foreground">
          Screen mode
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
          <p className="mt-3 text-sm text-muted-foreground">
            <Link href="/admin/videos" className="font-semibold text-secondary underline underline-offset-2">
              Upload a video
            </Link>{' '}
            to use Video mode.
          </p>
        )}
      </section>

      {/* Playback */}
      {isVideo ? (
        <section className="admin-card mt-6 w-full p-4 sm:p-6" aria-labelledby="video-playback-heading">
          <h2 id="video-playback-heading" className="text-eyebrow text-muted-foreground">
            Video playback
          </h2>
          <p className="mt-1 mb-4 min-h-5 truncate text-sm font-medium text-foreground" aria-live="polite">
            {currentVideoTitle ? `${videoPlaying ? 'Now playing' : 'Paused'}: ${currentVideoTitle}` : 'No video selected'}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
          {screen && !screen.audioUnlocked && (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-left text-sm text-warning">
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
            commands: { previous: 'testimonials.previous', next: 'testimonials.next', play: 'testimonials.play', pause: 'testimonials.pause' },
            noun: 'testimonial',
            disabled: playbackDisabled,
          })}
          {playbackRow({
            id: 'banner-playback',
            title: 'Group photo banner',
            status: bannerStatus,
            paused: bannerPaused,
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
