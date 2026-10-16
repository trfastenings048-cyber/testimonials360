'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import type * as Ably from 'ably';
import { fetchCertificates, fetchImages, fetchDisplaySettings, CertificateRecord } from '@/lib/api';
import { imageSrc } from '@/lib/image-urls';
import { AnimatePresence, motion } from 'motion/react';
import { EventImage } from '@/types';
import { Award, ChevronLeft, ChevronRight, Film, Loader2, Maximize, Minimize, Pause, Play, Volume2, WifiOff } from 'lucide-react';
import {
  CHANNELS,
  MODE_CHANGED,
  isCommandName,
  isModeChangedData,
  type CommandData,
  type ContentEvents,
  type DisplayMode,
  type DisplayVideo,
  type ScreenState,
} from '@/lib/realtime/protocol';
import { useChannelMessages, useRealtimeClient, useScreenPresence } from '@/lib/realtime/client';

const GROUP_DURATION = 8000;
const TESTIMONIAL_DURATION = 5000;
const PROGRESS_STEP = 50;
/** Commands older than this (e.g. replayed after a reconnect) are ignored. */
const COMMAND_MAX_AGE_MS = 10_000;
const SYSTEM_INTRO_EMAIL = 'system-intro@gates.com';

const normalizeGroupName = (groupName?: string) => groupName?.trim().toLowerCase() || '';

const getDisplayGroupImages = (images: EventImage[]) => {
  const newestImageByGroup = new Map<string, EventImage>();

  images.forEach((image) => {
    const groupKey = normalizeGroupName(image.groupName);
    if (groupKey && !newestImageByGroup.has(groupKey)) {
      newestImageByGroup.set(groupKey, image);
    }
  });

  return Array.from(newestImageByGroup.values()).sort((a, b) =>
    a.groupName.localeCompare(b.groupName, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
};

const isDisplayableTestimonial = (certificate: Partial<CertificateRecord> | null | undefined) =>
  Boolean(certificate?.showOnDisplay) &&
  certificate?.userEmail !== SYSTEM_INTRO_EMAIL &&
  Boolean(certificate?.feedback?.trim());

const byNewest = (a: CertificateRecord, b: CertificateRecord) => b.createdAt - a.createdAt;
const byNewestImage = (a: EventImage, b: EventImage) => b.timestamp - a.timestamp;

const slideVariants = {
  enter: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? '100%' : '-100%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? '-100%' : '100%',
    opacity: 0,
  }),
};

export default function BigScreen() {
  const [images, setImages] = useState<EventImage[]>([]);
  const [testimonials, setTestimonials] = useState<CertificateRecord[]>([]);
  const [rawImageIndex, setCurrentImageIndex] = useState(0);
  const [rawTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  // Display settings (loaded once, then kept live via `mode.changed`).
  const [mode, setMode] = useState<DisplayMode>('testimonials');
  const [video, setVideo] = useState<DisplayVideo | null>(null);
  const [testimonialAutoPlay, setTestimonialAutoPlay] = useState(true);
  const [testimonialDurationMs, setTestimonialDurationMs] = useState(TESTIMONIAL_DURATION);
  const [videoAutoplay, setVideoAutoplay] = useState(true);
  const [videoLoop, setVideoLoop] = useState(true);

  const [isTestimonialPaused, setIsTestimonialPaused] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  // Bumped on manual navigation so presence reports the new position (auto-rotation doesn't).
  const [manualNavCount, setManualNavCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { client, connection } = useRealtimeClient('display');

  // ---------------------------------------------------------------------------
  // Initial load (the only API reads this screen makes) and resync after a long outage
  // ---------------------------------------------------------------------------

  const loadAll = useCallback(() => {
    const imagesRequest = fetchImages(true)
      .then(setImages)
      .catch((error) => console.error('Error loading group images:', error));

    const testimonialsRequest = fetchCertificates(true)
      .then((certificates) => setTestimonials(certificates.filter(isDisplayableTestimonial).sort(byNewest)))
      .catch((error) => console.error('Error loading testimonials:', error));

    const settingsRequest = fetchDisplaySettings()
      .then((settings) => {
        setMode(settings.mode === 'video' ? 'video' : 'testimonials');
        setVideo(settings.video ?? null);
        setTestimonialAutoPlay(settings.testimonialAutoPlay);
        setTestimonialDurationMs(settings.testimonialDurationMs || TESTIMONIAL_DURATION);
        setVideoAutoplay(settings.videoAutoplay);
        setVideoLoop(settings.videoLoop);
      })
      .catch((error) => console.error('Error loading display settings:', error));

    return Promise.all([imagesRequest, testimonialsRequest, settingsRequest]);
  }, []);

  useEffect(() => {
    loadAll().finally(() => setIsLoading(false));
  }, [loadAll]);

  // Ably resumes short drops with no message loss; only a suspension (offline > 2 min)
  // can miss messages, so that's the one case that reloads.
  const clockOffsetRef = useRef(0);
  useEffect(() => {
    if (!client) return;
    const onChange = (change: Ably.ConnectionStateChange) => {
      if (change.current !== 'connected') return;
      // Ably's clock stamps messages; measure our offset so the staleness check is skew-proof.
      client
        .time()
        .then((serverTime) => {
          clockOffsetRef.current = serverTime - Date.now();
        })
        .catch(() => undefined);
      if (change.previous === 'suspended') void loadAll();
    };
    client.connection.on(onChange);
    return () => client.connection.off(onChange);
  }, [client, loadAll]);

  // ---------------------------------------------------------------------------
  // Derived positions
  // ---------------------------------------------------------------------------

  const groupImages = useMemo(() => getDisplayGroupImages(images), [images]);
  const currentImageIndex = groupImages.length ? rawImageIndex % groupImages.length : 0;
  const currentImage = groupImages[currentImageIndex] ?? null;

  const currentTestimonialIndex = testimonials.length
    ? ((rawTestimonialIndex % testimonials.length) + testimonials.length) % testimonials.length
    : 0;
  const currentTestimonial = testimonials[currentTestimonialIndex] ?? null;

  const showNextTestimonial = useCallback(() => setCurrentTestimonialIndex((index) => index + 1), []);
  const showPreviousTestimonial = useCallback(() => setCurrentTestimonialIndex((index) => index - 1), []);

  const resetProgress = () => {
    progressRef.current = 0;
    setProgress(0);
  };

  // Functional updates so back-to-back remote commands each move exactly one slide.
  const showNextGroup = () => {
    const count = groupImages.length;
    if (count === 0) return;
    setDirection('forward');
    setCurrentImageIndex((index) => ((index % count) + 1) % count);
    setManualNavCount((value) => value + 1);
    resetProgress();
  };

  const showPreviousGroup = () => {
    const count = groupImages.length;
    if (count === 0) return;
    setDirection('backward');
    setCurrentImageIndex((index) => ((index % count) - 1 + count) % count);
    setManualNavCount((value) => value + 1);
    resetProgress();
  };

  // ---------------------------------------------------------------------------
  // Realtime: commands and mode changes
  // ---------------------------------------------------------------------------

  const seenCommandIds = useRef<string[]>([]);

  useChannelMessages(client, CHANNELS.control, (message) => {
    if (message.name === MODE_CHANGED && isModeChangedData(message.data)) {
      setMode(message.data.mode);
      setVideo(message.data.video);
      setTestimonialAutoPlay(message.data.testimonialAutoPlay);
      setTestimonialDurationMs(message.data.testimonialDurationMs || TESTIMONIAL_DURATION);
      return;
    }

    if (!isCommandName(message.name)) return;
    const data = message.data as CommandData | undefined;
    const age = Date.now() + clockOffsetRef.current - (message.timestamp ?? Date.now());
    if (age > COMMAND_MAX_AGE_MS) return;
    if (data?.id) {
      if (seenCommandIds.current.includes(data.id)) return;
      seenCommandIds.current = [...seenCommandIds.current.slice(-49), data.id];
    }

    switch (message.name) {
      case 'testimonials.next':
        showNextTestimonial();
        setManualNavCount((count) => count + 1);
        break;
      case 'testimonials.previous':
        showPreviousTestimonial();
        setManualNavCount((count) => count + 1);
        break;
      case 'testimonials.pause':
        setIsTestimonialPaused(true);
        break;
      case 'testimonials.play':
        setIsTestimonialPaused(false);
        break;
      case 'banner.next':
        showNextGroup();
        break;
      case 'banner.previous':
        showPreviousGroup();
        break;
      case 'banner.pause':
        setIsPaused(true);
        break;
      case 'banner.play':
        setIsPaused(false);
        break;
      case 'video.play':
        // Allowed even before a tap because the video stays muted until then.
        videoRef.current?.play().catch((error) => console.warn('Video play was blocked:', error));
        break;
      case 'video.pause':
        videoRef.current?.pause();
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Realtime: content deltas (patched locally; no refetch)
  // ---------------------------------------------------------------------------

  useChannelMessages(client, CHANNELS.content, (message) => {
    switch (message.name) {
      case 'testimonial.updated':
      case 'testimonial.submitted': {
        const record = message.data as ContentEvents['testimonial.updated'] as CertificateRecord;
        setTestimonials((current) => {
          const others = current.filter((item) => item.id !== record.id);
          return isDisplayableTestimonial(record) ? [...others, record].sort(byNewest) : others;
        });
        break;
      }
      case 'testimonial.deleted': {
        const { ids } = message.data as ContentEvents['testimonial.deleted'];
        setTestimonials((current) => current.filter((item) => !ids.includes(item.id)));
        break;
      }
      case 'testimonials.cleared':
        setTestimonials([]);
        break;
      case 'image.updated': {
        const image = message.data as ContentEvents['image.updated'];
        setImages((current) => {
          const isNew = !current.some((item) => item.id === image.id);
          const others = current.filter((item) => item.id !== image.id);
          const next = image.isVisible ? [image, ...others].sort(byNewestImage) : others;
          if (isNew && image.isVisible) {
            // Jump to the newly uploaded group so the room sees it straight away.
            const groupIndex = getDisplayGroupImages(next).findIndex(
              (item) => normalizeGroupName(item.groupName) === normalizeGroupName(image.groupName)
            );
            if (groupIndex >= 0) {
              setDirection('forward');
              setCurrentImageIndex(groupIndex);
              progressRef.current = 0;
              setProgress(0);
            }
          }
          return next;
        });
        break;
      }
      case 'image.deleted': {
        const { id } = message.data as ContentEvents['image.deleted'];
        setImages((current) => current.filter((item) => item.id !== id));
        break;
      }
      case 'video.deleted': {
        const { id } = message.data as ContentEvents['video.deleted'];
        setVideo((current) => (current?.id === id ? null : current));
        break;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Presence: report state on discrete changes only
  // ---------------------------------------------------------------------------

  const screenState: ScreenState = {
    mode,
    testimonials: { paused: isTestimonialPaused, index: currentTestimonialIndex, count: testimonials.length },
    banner: {
      paused: isPaused,
      index: currentImageIndex,
      count: groupImages.length,
      groupName: currentImage?.groupName ?? null,
    },
    video: { id: video?.id || null, title: video?.title ?? null, playing: isVideoPlaying },
    audioUnlocked,
  };
  const presenceVersion = [
    mode,
    isTestimonialPaused,
    isPaused,
    manualNavCount,
    testimonials.length,
    groupImages.length,
    video?.url ?? '',
    isVideoPlaying,
    audioUnlocked,
  ].join('|');
  useScreenPresence(client, screenState, presenceVersion);

  // ---------------------------------------------------------------------------
  // Audio unlock: browsers mute autoplay until the page has had one user gesture
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (audioUnlocked) return;
    const unlock = () => setAudioUnlocked(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [audioUnlocked]);

  // React doesn't reliably reflect `muted` changes to the DOM, so set it directly.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !audioUnlocked;
  }, [audioUnlocked, video?.url, mode]);

  // ---------------------------------------------------------------------------
  // Local timers (no network)
  // ---------------------------------------------------------------------------

  // Testimonials rotate independently from the group images.
  useEffect(() => {
    if (mode !== 'testimonials' || testimonials.length <= 1 || isTestimonialPaused || !testimonialAutoPlay) return;
    const interval = window.setInterval(showNextTestimonial, testimonialDurationMs || TESTIMONIAL_DURATION);
    return () => window.clearInterval(interval);
  }, [mode, testimonials.length, isTestimonialPaused, testimonialAutoPlay, testimonialDurationMs, showNextTestimonial]);

  // Group slideshow: advance when the progress bar fills. The advance happens in the
  // timer callback (not a state updater) so Strict Mode's double-invoke can't skip slides.
  useEffect(() => {
    if (mode !== 'testimonials' || isPaused || groupImages.length <= 1) return;
    const interval = window.setInterval(() => {
      progressRef.current += (PROGRESS_STEP / GROUP_DURATION) * 100;
      if (progressRef.current >= 100) {
        progressRef.current = 0;
        setDirection('forward');
        setCurrentImageIndex((index) => index + 1);
      }
      setProgress(progressRef.current);
    }, PROGRESS_STEP);
    return () => window.clearInterval(interval);
  }, [mode, groupImages.length, isPaused]);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch (error) {
      console.error('Unable to toggle fullscreen mode:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#032b69] text-white">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-[#00a9b7]" />
        <p className="text-xl font-medium uppercase tracking-widest">Initializing Display...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full select-none overflow-hidden bg-white font-sans text-white">
      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        className="absolute right-3 top-3 z-[100] flex items-center justify-center rounded-full border border-white/30 bg-[#032b69]/80 p-2.5 text-white shadow-xl backdrop-blur-sm transition hover:bg-[#00a9b7] active:scale-95 sm:right-4 sm:top-4"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
      >
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>

      {/* Only shown when realtime is down for long enough to matter. */}
      {connection === 'offline' && (
        <div className="absolute right-16 top-4 z-[100] flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> Reconnecting…
        </div>
      )}

      {mode === 'video' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#032b69]">
          {video ? (
            <video
              key={video.url}
              ref={videoRef}
              className="h-full w-full object-contain"
              src={video.url}
              autoPlay={videoAutoplay}
              loop={videoLoop}
              muted={!audioUnlocked}
              controls
              playsInline
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
              onEnded={() => setIsVideoPlaying(false)}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center text-white">
              <Film className="h-14 w-14 text-[#70e1e8]" aria-hidden="true" />
              <p className="text-lg font-semibold">No video configured</p>
            </div>
          )}
          {video && !audioUnlocked && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              <Volume2 className="h-4 w-4" aria-hidden="true" /> Tap the screen once to turn on sound
            </div>
          )}
        </div>
      )}

      {/* Full-screen group slideshow with the testimonial overlaid on top. */}
      {/* Background gradient: white at the top fading to navy at the bottom. */}
      <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-white from-30% to-[#032b69]">
        {/* Default (sync) mode: the next slide enters while the previous one exits, so there is no empty gap. */}
        <AnimatePresence initial={false} custom={direction}>
          {currentImage ? (
            <motion.div
              key={currentImage.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              {/* Slide fills the full screen; the gradient shows around the photo. */}
              <Image
                src={imageSrc(currentImage, 'full')}
                alt={`${currentImage.groupName} group`}
                fill
                priority
                unoptimized
                sizes="100vw"
                className="pointer-events-none object-contain"
              />
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#111111]/60">
              <Award className="h-16 w-16 text-[#00a9b7]" />
              <span className="text-sm font-semibold uppercase tracking-wider">Waiting for group images...</span>
            </div>
          )}
        </AnimatePresence>

        {/* Gradient over the full-screen slide: clear/white at the top, navy at the bottom. */}
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-transparent from-45% via-[#032b69]/55 via-75% to-[#032b69]" />

        <div className="absolute left-3 top-3 z-30 flex items-center gap-2 sm:left-4 sm:top-4">
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            className="flex items-center justify-center rounded-full border border-white/30 bg-[#032b69]/80 p-2 text-white shadow-lg transition hover:bg-[#00a9b7] active:scale-95"
            title={isPaused ? 'Play group images' : 'Pause group images'}
          >
            {isPaused ? <Play className="h-4 w-4 fill-white" /> : <Pause className="h-4 w-4 fill-white" />}
          </button>
          {currentImage && (
            <div className="rounded-full border border-[#032b69]/15 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#111111] shadow-sm backdrop-blur-sm">
              📷 {currentImage.groupName}
              <span className="ml-2 text-[#00a9b7]">
                {currentImageIndex + 1}/{groupImages.length}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={showPreviousGroup}
          className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#032b69]/80 p-2 text-white shadow-lg transition hover:bg-[#00a9b7] active:scale-95 sm:left-4 sm:p-3 md:left-6"
          title="Previous group image"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={showNextGroup}
          className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#032b69]/80 p-2 text-white shadow-lg transition hover:bg-[#00a9b7] active:scale-95 sm:right-4 sm:p-3 md:right-6"
          title="Next group image"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-1 bg-white/20 md:h-1.5">
          <div style={{ width: `${progress}%` }} className="h-full bg-[#00a9b7] transition-all duration-75 ease-linear" />
        </div>

        {/* Overlay row: testimonial on the left. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 p-4 pb-[2%] sm:gap-6 sm:p-6 sm:pb-[2%] lg:p-8 lg:pb-[2%]">
          {/* Full-width fixed-height frosted review card, text aligned left. */}
          <div className="pointer-events-auto relative h-[180px] w-full overflow-hidden rounded-xl border border-white/60 border-l-[6px] border-l-[#00a9b7] bg-white/60 px-5 py-4 text-left text-[#111111] shadow-2xl backdrop-blur-xl sm:px-8 sm:py-6">
            <AnimatePresence mode="wait">
              {currentTestimonial ? (
                <motion.div
                  key={currentTestimonial.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.45 }}
                  className="relative h-full"
                >
                  <p className="text-[0.6rem] font-medium italic leading-relaxed text-[#111111] sm:text-[0.7rem] md:text-[0.8rem] lg:text-[0.9rem] xl:text-[1rem] 2xl:text-[1.1rem]">
                    “{currentTestimonial.feedback}”
                  </p>
                  <div className="absolute bottom-0 left-0 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-[0.5rem] font-bold uppercase text-[#032b69] sm:text-[0.55rem] md:text-[0.6rem] lg:text-[0.7rem] xl:text-[0.8rem]">
                      {currentTestimonial.userName || 'Anonymous'}
                    </span>
                    <span className="text-xs text-[#111111]/30">|</span>
                    <span className="text-[0.5rem] font-semibold uppercase tracking-wider text-[#111111]/70 md:text-[0.55rem] lg:text-[0.6rem] xl:text-[0.7rem]">
                      {[currentTestimonial.designation, currentTestimonial.teamName].filter(Boolean).join(' at ') ||
                        'Participant'}
                    </span>
                    {testimonials.length > 1 && (
                      <span className="ml-auto pl-3 text-[10px] font-semibold tabular-nums text-[#111111]/50">
                        {currentTestimonialIndex + 1} / {testimonials.length}
                      </span>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="no-testimonial" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-base font-bold uppercase tracking-wide text-[#032b69] sm:text-lg md:text-xl lg:text-2xl xl:text-3xl">
                    {currentImage?.groupName || 'Sanitation Sandbox'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[#111111]/75 sm:text-sm md:text-base lg:text-lg">
                    Group capture from the Sanitation Sandbox experience.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {testimonials.length > 1 && (
            <div className="pointer-events-auto absolute bottom-5 right-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  showPreviousTestimonial();
                  setManualNavCount((count) => count + 1);
                }}
                className="rounded-full bg-[#032b69]/80 p-2"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsTestimonialPaused((value) => !value)}
                className="rounded-full bg-[#032b69]/80 p-2"
                aria-label={isTestimonialPaused ? 'Play testimonials' : 'Pause testimonials'}
              >
                {isTestimonialPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  showNextTestimonial();
                  setManualNavCount((count) => count + 1);
                }}
                className="rounded-full bg-[#032b69]/80 p-2"
                aria-label="Next testimonial"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
