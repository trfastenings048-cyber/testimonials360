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
  Volume2,
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
  size = 'large',
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  active?: boolean;
  tone?: 'neutral' | 'primary' | 'accent';
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'large' | 'medium' | 'small';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={tone === 'primary' ? active : undefined}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-2 font-medium outline-none transition-all active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border disabled:border-slate-700/70 disabled:bg-[#16213e] disabled:text-slate-500 disabled:shadow-none disabled:opacity-100 disabled:[&_svg]:text-slate-500',
        size === 'large' && 'h-16 text-sm sm:h-[76px] [&_svg]:size-5 sm:[&_svg]:size-6',
        size === 'medium' && 'h-[58px] rounded-xl text-xs [&_svg]:size-4',
        size === 'small' && 'h-[52px] rounded-xl text-xs [&_svg]:size-4',
        tone === 'primary' &&
          (active
            ? 'border border-[#6284ea] bg-[#3150a7] text-white shadow-lg shadow-[#14275f]/55'
            : 'border border-[#2a3d63] bg-[#141f38] text-slate-100 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.9)] hover:border-[#4567b1] hover:bg-[#1a2948]'),
        tone === 'accent' && 'border border-[#6284ea] bg-[#3150a7] text-white shadow-lg shadow-[#14275f]/55 hover:bg-[#3d61c2]',
        tone === 'neutral' &&
          (active
            ? 'border border-[#4567b1] bg-[#1e315b] text-white shadow-[0_10px_22px_-16px_rgba(0,0,0,0.9)]'
            : 'border border-[#2a3d63] bg-[#141f38] text-slate-100 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.9)] hover:border-[#4567b1] hover:bg-[#1a2948]')
      )}
    >
      {icon}
      <span>{label}</span>
      {hint && <span className="max-w-full truncate text-[11px] font-normal opacity-70">{hint}</span>}
    </button>
  );
}

export function ControlPage({ embedded = false }: { embedded?: boolean }) {
  const {
    settings, setSettings, screens, connection, realtime, publishCommand,
    screenControlConnected, screenControlSecondsRemaining, connectScreenControls, disconnectScreenControls,
  } = useAdminData();
  const [savingMode, setSavingMode] = useState<DisplaySettings['mode'] | null>(null);
  const [pendingCommand, setPendingCommand] = useState<CommandName | null>(null);
  const [latestVideo, setLatestVideo] = useState<VideoRecord | null>(null);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [partCount, setPartCount] = useState<number | null>(null);
  const [savingSet, setSavingSet] = useState<'single' | 'parts' | null>(null);
  const [savingSound, setSavingSound] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState(68);

  // A display running an older build may omit the new audio fields from its live update.
  // Always retain a concrete number so this remains a controlled range input.
  useEffect(() => setVolumeDraft(settings.videoVolume ?? 68), [settings.videoVolume]);

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

  const saveSound = async (update: Pick<DisplaySettings, 'videoMuted' | 'videoVolume'>) => {
    setSavingSound(true);
    try {
      const saved = await updateDisplaySettings(update);
      setSettings(saved);
    } catch (error) {
      setVolumeDraft(settings.videoVolume ?? 68);
      toast.error(error instanceof Error ? error.message : 'Failed to save sound settings');
    } finally {
      setSavingSound(false);
    }
  };

  const commandIcon = (command: CommandName, icon: ReactNode) =>
    pendingCommand === command ? <Loader2 className="animate-spin" /> : icon;

  const testimonialsPaused = screen?.testimonials.paused ?? false;

  const videoPlaying = screen?.video.playing ?? false;
  const clipCount = screen?.video.count ?? 0;
  const clipIndex = screen?.video.index ?? 0;
  const playbackDisabled = !hasScreen || connection !== 'live' || !screenControlConnected;
  const controlsDisabled = connection !== 'live' || !screenControlConnected;
  const remainingLabel = `${Math.floor(screenControlSecondsRemaining / 60)}:${String(screenControlSecondsRemaining % 60).padStart(2, '0')}`;

  const toggleScreenConnection = () => {
    if (screenControlConnected) {
      disconnectScreenControls();
      toast.info('Screen controls disconnected');
      return;
    }
    if (connectScreenControls()) toast.success(`Connected to ${screens.length} screen${screens.length === 1 ? '' : 's'} for 5 minutes`);
    else toast.error('No live screen found. Open /display on the screen, then try again.');
  };

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
          size="small"
          onClick={() => void send(commands.previous)}
          icon={commandIcon(commands.previous, <ChevronLeft />)}
          label="Left"
          ariaLabel={`Previous ${noun}`}
        />
        <ControlButton
          tone="accent"
          disabled={disabled}
          size="small"
          onClick={() => void send(paused ? commands.play : commands.pause)}
          icon={commandIcon(paused ? commands.play : commands.pause, paused ? <Play /> : <Pause />)}
          label={paused ? 'Play' : 'Pause'}
          ariaLabel={`${paused ? 'Resume' : 'Pause'} ${noun}s`}
        />
        <ControlButton
          disabled={disabled}
          size="small"
          onClick={() => void send(commands.next)}
          icon={commandIcon(commands.next, <ChevronRight />)}
          label="Right"
          ariaLabel={`Next ${noun}`}
        />
      </div>
    </section>
  );

  return (
    <div id={embedded ? 'live-control' : undefined} className={cn('flex w-full flex-col items-center text-center', embedded ? 'py-0' : 'mx-auto max-w-md py-2 sm:py-4')}>
      {!embedded && <>
        <p className="text-eyebrow text-muted-foreground">Live control</p>
        <h1 className="mt-1 text-xl font-normal tracking-tight text-ink sm:text-2xl">Control the Testimonials Display page</h1>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Choose what the big screen shows, then control playback. Changes reach every connected screen instantly.
        </p>
      </>}

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

      <section className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3 text-left" aria-label="Screen connection">
        <div>
          <p className="text-sm font-medium text-ink">Screen connection</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {screenControlConnected
              ? `${screens.length} live screen${screens.length === 1 ? '' : 's'} found · disconnects in ${remainingLabel}`
              : 'Connect to discover a live display and enable controls for 5 minutes.'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleScreenConnection}
          className={cn(
            'shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
            screenControlConnected
              ? 'border border-amber-400/25 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
              : 'border border-[#5475d6] bg-[#3150a7] text-white shadow-sm shadow-[#3150a7]/30 hover:bg-[#3d61c2]'
          )}
        >
          {screenControlConnected ? `Disconnect ${remainingLabel}` : 'Connect'}
        </button>
      </section>

      {/* Mode */}
      <section className={cn('w-full', embedded ? 'mt-0' : 'mt-6')} aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="mb-2 text-eyebrow text-muted-foreground">
          Screen mode
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <ControlButton
            tone="primary"
            active={!isVideo}
            disabled={savingMode !== null || controlsDisabled}
            onClick={() => void changeDisplayMode('testimonials')}
            icon={savingMode === 'testimonials' ? <Loader2 className="animate-spin" /> : <MessageSquareQuote />}
            label="Testimonials"
          />
          <ControlButton
            tone="primary"
            active={isVideo}
            disabled={savingMode !== null || controlsDisabled || (videosLoaded && !latestVideo)}
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
              disabled={savingSet !== null || controlsDisabled || (videosLoaded && !latestVideo)}
              onClick={() => void changeVideoSet('single')}
              icon={savingSet === 'single' ? <Loader2 className="animate-spin" /> : <Film />}
              label="Video 1"
              size="medium"
              hint={latestVideo?.title ?? (videosLoaded ? 'No video uploaded' : undefined)}
            />
            <ControlButton
              tone="primary"
              active={activeSet === 'parts'}
              disabled={savingSet !== null || controlsDisabled || !partCount}
              onClick={() => void changeVideoSet('parts')}
              icon={savingSet === 'parts' ? <Loader2 className="animate-spin" /> : <Film />}
              label="Video 2"
              size="medium"
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
              size="small"
            />
            <ControlButton
              tone={videoPlaying ? 'accent' : 'neutral'}
              active={hasScreen && !videoPlaying}
              disabled={playbackDisabled}
              onClick={() => void send('video.pause')}
              icon={commandIcon('video.pause', <Pause />)}
              label={hasScreen && !videoPlaying ? 'Paused' : 'Pause'}
              ariaLabel="Pause video"
              size="small"
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
                  size="small"
                />
                <ControlButton
                  disabled={playbackDisabled}
                  onClick={() => void send('video.next')}
                  icon={commandIcon('video.next', <SkipForward />)}
                  label="Next part"
                  ariaLabel="Next video part"
                  size="small"
                />
              </div>
            </div>
          )}
          <section className="mt-3 rounded-2xl border border-border bg-muted/30 p-3 text-left" aria-labelledby="sound-heading">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id="sound-heading" className="text-sm font-medium text-ink">Sound</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {settings.videoMuted ? 'Muted on all screens' : `${volumeDraft ?? 68}% volume on all screens`}
                </p>
              </div>
              <button
                type="button"
                disabled={savingSound || controlsDisabled}
                onClick={() => void saveSound({ videoMuted: !settings.videoMuted, videoVolume: volumeDraft })}
                aria-pressed={!settings.videoMuted}
                aria-label={settings.videoMuted ? 'Unmute big screen sound' : 'Mute big screen sound'}
                title={settings.videoMuted ? 'Unmute big screen sound' : 'Mute big screen sound'}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-50',
                  settings.videoMuted
                    ? 'border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
                    : 'border border-[#5475d6] bg-[#1e315b] text-white shadow-sm shadow-[#14275f]/40 hover:bg-[#294274]'
                )}
              >
                {savingSound ? <Loader2 className="size-4 animate-spin" /> : settings.videoMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                {settings.videoMuted ? 'Muted' : 'Sound on'}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <VolumeX className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={volumeDraft ?? 68}
                disabled={savingSound || controlsDisabled}
                onChange={(event) => setVolumeDraft(Number(event.target.value))}
                onPointerUp={() => {
                  if (volumeDraft !== settings.videoVolume) void saveSound({ videoMuted: false, videoVolume: volumeDraft ?? 68 });
                }}
                onKeyUp={() => {
                  if (volumeDraft !== settings.videoVolume) void saveSound({ videoMuted: false, videoVolume: volumeDraft ?? 68 });
                }}
                className="h-2 w-full cursor-pointer accent-[#6386eb] disabled:cursor-not-allowed"
                aria-label="Big screen volume"
              />
              <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <output className="w-9 text-right text-xs font-medium tabular-nums text-ink" aria-live="polite">{volumeDraft ?? 68}%</output>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {screen?.audioUnlocked
                ? 'Sound is ready on this screen.'
                : 'A person must tap or press a key on each screen once before its browser can play sound.'}
            </p>
          </section>
          {screen && !screen.audioUnlocked && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl border border-warning/25 bg-warning/10 px-3 py-2 text-left text-xs text-warning">
              <VolumeX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Audio settings are saved, but the browser keeps this screen muted until someone taps it once.
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
