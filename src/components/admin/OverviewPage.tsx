'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Download,
  Film,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  MonitorOff,
  Pause,
  Play,
  RotateCw,
  Tv,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { EventImage } from '@/types';
import { updateDisplaySettings } from '@/lib/api';
import { useAdminData } from './AdminDataProvider';
import { getImageStatuses, timeAgo } from './overview/imageStatus';
import { UploadPhotosModal } from './overview/UploadPhotosModal';
import { ExportCsvModal } from './overview/ExportCsvModal';
import { DarkModeModal } from './overview/DarkModeModal';
import { UploadVideoModal } from './overview/UploadVideoModal';
import { PhotosDrawer } from './overview/PhotosDrawer';
import { TestimonialsDrawer } from './overview/TestimonialsDrawer';
import { VideosDrawer } from './overview/VideosDrawer';
import { ControlPage } from './ControlPage';
import { ContentLibraryTable } from './overview/ContentLibraryTable';

/** Accessible toggle switch */
function PrototypeSwitch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="flex items-center gap-2 cursor-pointer select-none">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer',
          checked ? 'bg-[#9bb3ff]' : 'bg-[#243354]'
        )}
      >
        <span
          className={cn(
            'inline-block size-3.5 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-1'
          )}
        />
      </button>
      <label
        htmlFor={id}
        onClick={() => onChange(!checked)}
        className="text-xs text-slate-200 cursor-pointer whitespace-nowrap"
      >
        {label}
      </label>
    </div>
  );
}

/** Stat + action card used for Photos / Testimonials / Videos */
function StatCard({
  label,
  icon,
  value,
  unit,
  description,
  footerLeft,
  onLabelClick,
  actionLabel,
  actionIcon,
  onAction,
  divider,
}: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  unit: string;
  description: string;
  footerLeft: string;
  onLabelClick: () => void;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: () => void;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between py-6 sm:py-0',
        divider && 'border-t border-slate-800/70 md:border-t-0 md:border-l md:border-slate-800/70 md:pl-8'
      )}
    >
      <div>
        {/* Label row */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <button
            type="button"
            onClick={onLabelClick}
            className="text-sm font-medium text-slate-300 hover:text-white cursor-pointer underline-offset-2 hover:underline transition-colors text-left"
          >
            {label}
          </button>
          <span className="text-slate-500">{icon}</span>
        </div>

        {/* Big number */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl sm:text-5xl font-light text-white tracking-tight leading-none">
            {value}
          </span>
          <span className="text-xs text-slate-400 font-normal">{unit}</span>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 mt-2 mb-5 min-h-[32px] leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-slate-500 font-normal">{footerLeft}</span>
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-[#121a30] border border-slate-700/70 hover:bg-[#1a2544] hover:border-slate-600 px-3.5 py-1.5 text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95 shrink-0"
        >
          {actionIcon}
          <span>{actionLabel}</span>
        </button>
      </div>
    </div>
  );
}

export function OverviewPage() {
  const router = useRouter();
  const {
    images,
    setImages,
    certificates,
    settings,
    setSettings,
    screens,
    connection,
    refresh,
    isRefreshing,
    publishCommand,
  } = useAdminData();

  // Modal / drawer open states
  const [uploadPhotosOpen, setUploadPhotosOpen] = useState(false);
  const [exportCsvOpen, setExportCsvOpen] = useState(false);
  const [darkModeOpen, setDarkModeOpen] = useState(false);
  const [uploadVideoOpen, setUploadVideoOpen] = useState(false);
  const [photosDrawerOpen, setPhotosDrawerOpen] = useState(false);
  const [testimonialsDrawerOpen, setTestimonialsDrawerOpen] = useState(false);
  const [videosDrawerOpen, setVideosDrawerOpen] = useState(false);
  const [activeLibrary, setActiveLibrary] = useState<'photos' | 'testimonials' | 'videos' | null>(null);

  // Control state
  const [screenShows, setScreenShows] = useState<'testimonials' | 'video'>('video');
  const [videoSet, setVideoSet] = useState<'single' | 'parts'>('parts');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(68);
  const [isMuted, setIsMuted] = useState(false);

  // Bottom bar prototype toggles
  const [mockScreenConnected, setMockScreenConnected] = useState(false);
  const [softBlueStyle, setSoftBlueStyle] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  // 'U' keyboard shortcut → upload photos
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'u' && e.key !== 'U') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      e.preventDefault();
      setUploadPhotosOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Sync live settings
  useEffect(() => {
    if (settings.mode) setScreenShows(settings.mode);
    if (settings.videoSet) setVideoSet(settings.videoSet);
  }, [settings.mode, settings.videoSet]);

  const onUploaded = useCallback(
    (image: EventImage) => {
      setImages((prev) => [image, ...prev.filter((item) => item.id !== image.id)]);
    },
    [setImages]
  );

  const isConnected = mockScreenConnected || (screens.length > 0 && connection === 'live');
  const liveScreen = screens[0];
  const liveMode = liveScreen?.mode ?? settings.mode;
  const livePlaying = liveMode === 'video' ? (liveScreen?.video.playing ?? false) : !(liveScreen?.testimonials.paused ?? false);

  // Derived stats
  const photoStats = useMemo(() => {
    let onScreen = 0;
    let hidden = 0;
    getImageStatuses(images).forEach(({ status }) => {
      if (status === 'on-screen') onScreen += 1;
      if (status === 'hidden') hidden += 1;
    });
    const uniqueGroups = new Set(images.map((img) => img.groupName.trim())).size;
    const latest = images.reduce<EventImage | null>(
      (n, img) => (!n || img.timestamp > n.timestamp ? img : n),
      null
    );
    return {
      groupsCount: uniqueGroups || 5,
      onScreen: onScreen || 3,
      hidden: hidden || 2,
      lastUploadText: latest ? `Last upload ${timeAgo(latest.timestamp)}` : 'Last upload 2 days ago',
    };
  }, [images]);

  const testimonialStats = useMemo(() => {
    const count = certificates.length > 0 ? certificates.length : 3;
    const latest = certificates[0];
    const latestText = latest
      ? `Latest from ${latest.userName || 'Attendee'}${latest.teamName ? `, ${latest.teamName}` : ''}.`
      : 'Latest from Suhas Subhash Chougule, Lear Corporation.';
    return { count, latestText, todayText: 'None today' };
  }, [certificates]);

  // Handlers
  const handleDisplayModeChange = async (mode: 'testimonials' | 'video') => {
    setScreenShows(mode);
    try {
      await updateDisplaySettings({ mode });
      setSettings((prev) => ({ ...prev, mode }));
      toast.success(`Display switched to ${mode === 'video' ? 'Video' : 'Testimonials'}`);
    } catch { /* offline */ }
  };

  const handleVideoSetChange = async (set: 'single' | 'parts') => {
    setVideoSet(set);
    try {
      await updateDisplaySettings({ mode: 'video', videoSet: set });
      setSettings((prev) => ({ ...prev, videoSet: set }));
      toast.success(set === 'parts' ? 'Playing Video 2 (10 short parts)' : 'Playing Video 1');
    } catch { /* offline */ }
  };

  const handlePlayToggle = async () => {
    const next = !isPlaying;
    setIsPlaying(next);
    try {
      if (publishCommand) await publishCommand(next ? 'video.play' : 'video.pause');
    } catch { /* offline */ }
  };

  const handleLogout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }); } catch { /* ignore */ }
    router.replace('/admin/login');
    router.refresh();
  };

  const handleRefresh = async () => {
    try { await refresh(); toast.success('Data refreshed'); }
    catch { toast.error('Failed to refresh'); }
  };

  return (
    <div className={cn('min-h-screen w-full bg-[#0a0e1c] text-white flex flex-col justify-between selection:bg-[#9bb3ff] selection:text-[#0b1228]', !activeLibrary && 'lg:h-screen lg:overflow-hidden')}>

      {/* ------------------------------------------------------------------ */}
      {/* Main scrollable content                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className={cn('w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-6 flex-1', activeLibrary ? 'pb-10' : 'pb-8 lg:py-4')}>

        {/* ── Top Header Bar ─────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3 py-2">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 sm:size-10 rounded-full bg-[#131b32] border border-[#223156] flex items-center justify-center shrink-0 shadow-inner">
              <span className="text-xs sm:text-sm font-bold tracking-wider text-[#5a7bb5]">TR</span>
            </div>
            <div className="hidden xs:flex flex-col min-w-0">
              <span className="text-[11px] text-slate-400 leading-tight">TR Fastenings</span>
              <h1 className="text-sm sm:text-base lg:text-lg font-bold text-white leading-tight tracking-tight truncate">
                360 Camera Admin
              </h1>
            </div>
          </div>

          {/* Nav links — hidden on very small screens */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/display"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Big screen <ArrowUpRight className="size-3" />
            </Link>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Participant portal <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Connection status — text hidden on xs */}
            <div className="flex items-center gap-1.5 rounded-full bg-[#131b32] border border-slate-700/60 px-2.5 sm:px-3.5 py-1.5 text-xs text-slate-200">
              <span
                className={cn(
                  'size-2 rounded-full shrink-0',
                  isConnected ? 'bg-emerald-400 ring-2 ring-emerald-400/20' : 'bg-amber-400 ring-2 ring-amber-400/20'
                )}
              />
              <span className="hidden sm:inline whitespace-nowrap">
                {isConnected ? 'Screen connected' : 'No screen'}
              </span>
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh data"
              className="size-8 sm:size-9 rounded-full bg-[#131b32] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2542] transition-colors cursor-pointer"
            >
              <RotateCw className={cn('size-3.5 sm:size-4', isRefreshing && 'animate-spin')} />
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="size-8 sm:size-9 rounded-full bg-[#131b32] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2542] transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5 sm:size-4" />
            </button>
          </div>
        </header>

        {/* ── Top Section: Blue card + Controls ──────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8 mt-6 sm:mt-8 mb-6 sm:mb-8 lg:my-4">

          {/* Left: Blue status card */}
          <div className="bg-[#284297] rounded-2xl sm:rounded-3xl p-5 sm:p-7 flex flex-col justify-between shadow-xl shadow-[#284297]/15 min-h-[220px] sm:min-h-[260px] lg:min-h-0 lg:h-[340px]">
            <div>
              <p className="text-xs text-blue-200/80 font-normal mb-1.5">Now on the big screen</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-white mb-1.5">
                {liveMode === 'video'
                  ? livePlaying ? 'Video, playing' : 'Video, paused'
                  : livePlaying ? 'Testimonials, rotating' : 'Testimonials, paused'}
              </h2>
              <p className="text-xs sm:text-sm text-blue-100/80 font-normal">
                {liveMode === 'video'
                  ? liveScreen?.video.title ?? settings.video?.title ?? 'No video selected'
                  : liveScreen ? `Auto-cycling ${liveScreen.testimonials.count} attendee quotes on display` : 'Waiting for a display connection'}
              </p>
            </div>

            {/* Alert banner */}
            <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start gap-3 border border-amber-500/30 bg-[#1e2e62]/90 mt-5">
              {isConnected
                ? <Tv className="text-emerald-400 size-4 sm:size-5 shrink-0 mt-0.5" />
                : <MonitorOff className="text-amber-400 size-4 sm:size-5 shrink-0 mt-0.5" />}
              <p className="text-xs text-amber-100/90 leading-relaxed">
                {isConnected ? (
                  <><span className="font-semibold text-white">Big screen is connected.</span> Changes reach the display at /display in real-time.</>
                ) : (
                  <>No big screen is connected. Open{' '}
                    <Link href="/display" target="_blank" className="underline underline-offset-2 hover:text-white font-medium">/display</Link>
                    {' '}on the screen. Controls unlock as soon as it connects.</>
                )}
              </p>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex flex-col gap-4 sm:gap-5 lg:max-h-[340px] lg:overflow-y-auto lg:pr-1">
            <div className="rounded-2xl bg-white p-4 text-[#0b1228] shadow-xl sm:p-5">
              <p className="mb-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Display controls</p>
              <ControlPage embedded />
            </div>

            <div className="hidden">

            {/* Screen shows toggle */}
            <div>
              <span className="text-xs text-slate-400 mb-2 block">Screen shows</span>
              <div className="bg-[#131b31] border border-slate-800/80 rounded-xl sm:rounded-2xl p-1.5 flex gap-1.5">
                {(['testimonials', 'video'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleDisplayModeChange(mode)}
                    className={cn(
                      'flex-1 py-2.5 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl text-center text-xs sm:text-sm transition-all cursor-pointer capitalize',
                      screenShows === mode
                        ? 'bg-[#9bb3ff] text-[#0b1228] font-semibold shadow-sm'
                        : 'text-white hover:bg-white/5 font-medium'
                    )}
                  >
                    {mode === 'testimonials' ? 'Testimonials' : 'Video'}
                  </button>
                ))}
              </div>
            </div>

            {/* Video set + Play */}
            <div>
              <span className="text-xs text-slate-400 mb-2 block">Video set</span>
              <div className="flex items-stretch gap-2 sm:gap-3">
                <div className="flex-1 bg-[#131b31] border border-slate-800/80 rounded-xl sm:rounded-2xl p-1.5 grid grid-cols-2 gap-1.5">
                  {([
                    { key: 'single', label: 'Video 1', sub: 'Grant sub Safety kiosk' },
                    { key: 'parts', label: 'Video 2', sub: '10 short parts' },
                  ] as const).map(({ key, label, sub }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleVideoSetChange(key)}
                      className={cn(
                        'py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5',
                        videoSet === key
                          ? 'bg-[#9bb3ff] text-[#0b1228] font-semibold shadow-sm'
                          : 'text-white hover:bg-white/5 font-medium'
                      )}
                    >
                      <span className="text-xs sm:text-sm font-semibold leading-tight">{label}</span>
                      <span className={cn('text-[10px] sm:text-[11px] leading-tight truncate w-full text-center', videoSet === key ? 'text-[#0b1228]/75' : 'text-slate-400')}>
                        {sub}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Play/Pause button */}
                <button
                  type="button"
                  onClick={handlePlayToggle}
                  className="w-20 sm:w-24 rounded-xl sm:rounded-2xl bg-[#475569] hover:bg-[#566780] flex flex-col items-center justify-center gap-1 text-white/90 text-xs sm:text-sm font-medium transition-colors cursor-pointer active:scale-95 shadow-sm shrink-0"
                >
                  {isPlaying
                    ? <><Pause className="size-4 fill-white text-white" /><span>Pause</span></>
                    : <><Play className="size-4 fill-white text-white" /><span>Play</span></>}
                </button>
              </div>
            </div>

            {/* Sound */}
            <div>
              <span className="text-xs text-slate-400 mb-2 block">Big screen sound</span>
              <div className="bg-[#131b31] border border-slate-800/80 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="bg-[#19243f] border border-slate-700/60 hover:bg-[#223053] rounded-lg sm:rounded-xl px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="size-3.5 text-amber-400" /> : <Volume2 className="size-3.5" />}
                  <span className="hidden xs:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => { if (isMuted) setIsMuted(false); setVolume(Number(e.target.value)); }}
                    className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #9bb3ff 0%, #9bb3ff ${isMuted ? 0 : volume}%, #233254 ${isMuted ? 0 : volume}%, #233254 100%)`,
                    }}
                    aria-label="Volume"
                  />
                </div>
                <span className="text-xs font-semibold text-white min-w-[30px] sm:min-w-[34px] text-right tabular-nums">
                  {isMuted ? '0%' : `${volume}%`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 font-normal">
                Saved. The screen uses this level when it connects.
              </p>
            </div>
            </div>
          </div>
        </section>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <hr className="border-t border-slate-800/70" />

        {/* ── Bottom 3 Stat Cards ─────────────────────────────────────────── */}
        {/*
          Mobile:   1 column, cards stacked with top border dividers
          Tablet:   2 columns (Photos | Testimonials) then Videos below
          Desktop:  3 columns side-by-side with left-border dividers
        */}
        <section className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3 lg:pt-4">
          <StatCard
            label="Photos"
            icon={<ImageIcon className="size-4" />}
            value={photoStats.groupsCount}
            unit="groups"
            description={`${photoStats.onScreen} showing on the big screen, ${photoStats.hidden} hidden.`}
            footerLeft={photoStats.lastUploadText}
            onLabelClick={() => setActiveLibrary((current) => current === 'photos' ? null : 'photos')}
            actionLabel="Upload photos"
            actionIcon={<Upload className="size-3.5" />}
            onAction={() => setUploadPhotosOpen(true)}
          />

          <StatCard
            label="Testimonials"
            icon={<MessageSquare className="size-4" />}
            value={testimonialStats.count}
            unit="submissions"
            description={testimonialStats.latestText}
            footerLeft={testimonialStats.todayText}
            onLabelClick={() => setActiveLibrary((current) => current === 'testimonials' ? null : 'testimonials')}
            actionLabel="Export CSV"
            actionIcon={<Download className="size-3.5" />}
            onAction={() => setExportCsvOpen(true)}
            divider
          />

          <StatCard
            label="Videos"
            icon={<Film className="size-4" />}
            value={11}
            unit="videos"
            description="In 2 sets: Grant sub Safety kiosk, and TR Fastening in 10 short parts."
            footerLeft="Last upload 20 Oct 2026"
            onLabelClick={() => setActiveLibrary((current) => current === 'videos' ? null : 'videos')}
            actionLabel="Upload video"
            actionIcon={<Upload className="size-3.5" />}
            onAction={() => setUploadVideoOpen(true)}
            divider
          />
        </section>

        {activeLibrary && (
          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-700/80 bg-[#0e1628] shadow-2xl" aria-label={`${activeLibrary} library`}>
            <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-6">
              <div><h2 className="text-lg font-semibold text-white capitalize">{activeLibrary} library</h2><p className="mt-0.5 text-xs text-slate-400">Manage your event {activeLibrary} without leaving the dashboard.</p></div>
              <button type="button" onClick={() => setActiveLibrary(null)} aria-label={`Close ${activeLibrary} library`} className="size-10 rounded-full border border-slate-700 bg-[#16213e] text-lg text-slate-300 hover:bg-[#223158] hover:text-white">×</button>
            </header>
            {activeLibrary === 'photos' && <ContentLibraryTable images={images} setImages={setImages} loading={false} highlightId={null} onUploadClick={() => setUploadPhotosOpen(true)} />}
            {activeLibrary === 'testimonials' && <div className="p-6 text-sm text-slate-300">Open the testimonials manager to review, edit and export submissions.<button type="button" onClick={() => setTestimonialsDrawerOpen(true)} className="ml-3 rounded-full bg-[#9bb3ff] px-4 py-2 text-xs font-semibold text-[#0b1228]">Open testimonials table</button></div>}
            {activeLibrary === 'videos' && <div className="p-6 text-sm text-slate-300">Open the videos manager to search, preview and select videos for the display.<button type="button" onClick={() => setVideosDrawerOpen(true)} className="ml-3 rounded-full bg-[#9bb3ff] px-4 py-2 text-xs font-semibold text-[#0b1228]">Open videos table</button></div>}
          </section>
        )}
      </div>

      {/* ── Fixed Bottom Prototype Bar ────────────────────────────────────── */}
      <footer className="hidden">
        <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap px-4 py-3">
          <span className="text-xs text-slate-500 font-normal shrink-0">Prototype only</span>
          <PrototypeSwitch id="proto-screen-conn" checked={mockScreenConnected} onChange={setMockScreenConnected} label="Big screen connected" />
          <PrototypeSwitch id="proto-soft-blue" checked={softBlueStyle} onChange={setSoftBlueStyle} label="Soft blue style" />
          <PrototypeSwitch id="proto-dark-mode" checked={darkMode} onChange={() => setDarkModeOpen(true)} label="Dark mode" />
        </div>
      </footer>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <UploadPhotosModal open={uploadPhotosOpen} onOpenChange={setUploadPhotosOpen} images={images} onUploaded={onUploaded} />
      <ExportCsvModal open={exportCsvOpen} onOpenChange={setExportCsvOpen} certificates={certificates} />
      <DarkModeModal open={darkModeOpen} onOpenChange={setDarkModeOpen} darkMode={darkMode} setDarkMode={setDarkMode} softBlueStyle={softBlueStyle} setSoftBlueStyle={setSoftBlueStyle} />
      <UploadVideoModal open={uploadVideoOpen} onOpenChange={setUploadVideoOpen} />

      {/* ── Real-data Drawers ────────────────────────────────────────────── */}
      <PhotosDrawer open={photosDrawerOpen} onOpenChange={setPhotosDrawerOpen} />
      <TestimonialsDrawer open={testimonialsDrawerOpen} onOpenChange={setTestimonialsDrawerOpen} />
      <VideosDrawer open={videosDrawerOpen} onOpenChange={setVideosDrawerOpen} />
    </div>
  );
}
