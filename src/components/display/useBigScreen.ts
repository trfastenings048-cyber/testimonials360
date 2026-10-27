'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Ably from 'ably';
import { fetchCertificates, fetchImages, fetchDisplaySettings, CertificateRecord } from '@/lib/api';
import { EventImage } from '@/types';
import { getDisplayGroupImages, normalizeGroupName } from '@/lib/display-groups';
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
  type VideoSetKind,
} from '@/lib/realtime/protocol';
import { useChannelMessages, useRealtimeClient, useScreenPresence } from '@/lib/realtime/client';

const GROUP_DURATION = 8000;
const TESTIMONIAL_DURATION = 5000;
const PROGRESS_STEP = 50;
/** Commands older than this (e.g. replayed after a reconnect) are ignored. */
const COMMAND_MAX_AGE_MS = 10_000;
const SYSTEM_INTRO_EMAIL = 'system-intro@gates.com';

/** Older servers can omit new audio fields; media.volume rejects NaN and Infinity. */
const normalizeVolume = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 68;

const isDisplayableTestimonial = (certificate: Partial<CertificateRecord> | null | undefined) =>
  Boolean(certificate?.showOnDisplay) &&
  certificate?.userEmail !== SYSTEM_INTRO_EMAIL &&
  Boolean(certificate?.feedback?.trim());

const byNewest = (a: CertificateRecord, b: CertificateRecord) => b.createdAt - a.createdAt;
const byNewestImage = (a: EventImage, b: EventImage) => b.timestamp - a.timestamp;

export type SlideDirection = 'forward' | 'backward';

/**
 * All state, realtime wiring and timers for the big screen. The view components only
 * read this; nothing here renders.
 */
export function useBigScreen() {
  const [images, setImages] = useState<EventImage[]>([]);
  const [testimonials, setTestimonials] = useState<CertificateRecord[]>([]);
  const [rawImageIndex, setCurrentImageIndex] = useState(0);
  const [rawTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [direction, setDirection] = useState<SlideDirection>('forward');
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  // Display settings (loaded once, then kept live via `mode.changed`).
  const [mode, setMode] = useState<DisplayMode>('testimonials');
  const [playlist, setPlaylist] = useState<DisplayVideo[]>([]);
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoSet, setVideoSet] = useState<VideoSetKind>('single');
  // Once a clip has been advanced or skipped, the next one must start itself even if autoplay is off.
  const [continuePlayback, setContinuePlayback] = useState(false);
  const [testimonialAutoPlay, setTestimonialAutoPlay] = useState(true);
  const [testimonialDurationMs, setTestimonialDurationMs] = useState(TESTIMONIAL_DURATION);
  const [videoAutoplay, setVideoAutoplay] = useState(true);
  const [videoLoop, setVideoLoop] = useState(true);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(68);

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

  /** Swaps in a new playlist, restarting from the first clip only when its contents changed. */
  const applyPlaylist = useCallback((next: DisplayVideo[], set: VideoSetKind) => {
    setVideoSet(set);
    setPlaylist((current) => {
      const same = current.length === next.length && current.every((item, i) => item.url === next[i].url);
      if (same) return current;
      setVideoIndex(0);
      setContinuePlayback(false);
      return next;
    });
  }, []);

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
        applyPlaylist(settings.playlist ?? (settings.video ? [settings.video] : []), settings.videoSet ?? 'single');
        setTestimonialAutoPlay(settings.testimonialAutoPlay);
        setTestimonialDurationMs(settings.testimonialDurationMs || TESTIMONIAL_DURATION);
        setVideoAutoplay(settings.videoAutoplay);
        setVideoLoop(settings.videoLoop);
        setVideoMuted(settings.videoMuted === true);
        setVideoVolume(normalizeVolume(settings.videoVolume));
      })
      .catch((error) => console.error('Error loading display settings:', error));

    return Promise.all([imagesRequest, testimonialsRequest, settingsRequest]);
  }, [applyPlaylist]);

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
  const nextTestimonial =
    testimonials.length > 1 ? testimonials[(currentTestimonialIndex + 1) % testimonials.length] : null;

  const clipCount = playlist.length;
  const currentVideoIndex = clipCount ? Math.min(videoIndex, clipCount - 1) : 0;
  const video = playlist[currentVideoIndex] ?? null;
  const nextVideo = clipCount > 1 ? playlist[(currentVideoIndex + 1) % clipCount] : null;

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

  const goToClip = (offset: 1 | -1, { wrap }: { wrap: boolean }) => {
    if (clipCount <= 1) return;
    const target = currentVideoIndex + offset;
    if (!wrap && (target < 0 || target >= clipCount)) return;
    setVideoIndex((target + clipCount) % clipCount);
    setContinuePlayback(true);
  };
  const showNextClip = () => goToClip(1, { wrap: true });
  const showPreviousClip = () => goToClip(-1, { wrap: true });

  /** A clip finished: move to the next one, looping back to the first only when looping is on. */
  const handleVideoEnded = () => {
    if (clipCount <= 1) return;
    if (currentVideoIndex + 1 < clipCount) goToClip(1, { wrap: false });
    else if (videoLoop) {
      setVideoIndex(0);
      setContinuePlayback(true);
    }
  };

  // ---------------------------------------------------------------------------
  // Realtime: commands and mode changes
  // ---------------------------------------------------------------------------

  const seenCommandIds = useRef<string[]>([]);

  useChannelMessages(client, CHANNELS.control, (message) => {
    if (message.name === MODE_CHANGED && isModeChangedData(message.data)) {
      setMode(message.data.mode);
      applyPlaylist(message.data.playlist ?? (message.data.video ? [message.data.video] : []), message.data.videoSet ?? 'single');
      if (typeof message.data.videoAutoplay === 'boolean') setVideoAutoplay(message.data.videoAutoplay);
      if (typeof message.data.videoLoop === 'boolean') setVideoLoop(message.data.videoLoop);
      if (typeof message.data.videoMuted === 'boolean') setVideoMuted(message.data.videoMuted);
      setVideoVolume(normalizeVolume(message.data.videoVolume));
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
      case 'video.next':
        showNextClip();
        break;
      case 'video.previous':
        showPreviousClip();
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
        setPlaylist((current) => current.filter((item) => item.id !== id));
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
    video: {
      id: video?.id || null,
      title: video?.title ?? null,
      playing: isVideoPlaying,
      index: currentVideoIndex,
      count: clipCount,
      set: videoSet,
    },
    audioUnlocked,
    audioMuted: videoMuted || !audioUnlocked,
    audioVolume: normalizeVolume(videoVolume),
  };
  const presenceVersion = [
    mode,
    isTestimonialPaused,
    isPaused,
    manualNavCount,
    testimonials.length,
    groupImages.length,
    video?.url ?? '',
    currentVideoIndex,
    videoSet,
    isVideoPlaying,
    audioUnlocked,
    videoMuted,
    videoVolume,
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
    if (!videoRef.current) return;
    videoRef.current.muted = videoMuted || !audioUnlocked;
    videoRef.current.volume = normalizeVolume(videoVolume) / 100;
  }, [audioUnlocked, videoMuted, videoVolume, video?.url, mode]);

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

  return {
    isLoading,
    connection,
    mode,
    // Group banner
    groupImages,
    currentImage,
    currentImageIndex,
    direction,
    progress,
    isPaused,
    toggleGroupPaused: () => setIsPaused((paused) => !paused),
    showNextGroup,
    showPreviousGroup,
    // Testimonials
    testimonials,
    currentTestimonial,
    currentTestimonialIndex,
    nextTestimonial,
    // Video
    video,
    nextVideo,
    videoIndex: currentVideoIndex,
    videoCount: clipCount,
    videoSet,
    showNextClip,
    showPreviousClip,
    handleVideoEnded,
    videoRef,
    videoAutoplay: videoAutoplay || continuePlayback,
    // A multi-clip playlist loops by returning to the first clip, so the element itself must not loop.
    videoLoop: videoLoop && clipCount <= 1,
    videoMuted,
    videoVolume: normalizeVolume(videoVolume),
    audioUnlocked,
    isVideoPlaying,
    setIsVideoPlaying,
    // Fullscreen
    isFullscreen,
    toggleFullscreen,
  };
}

export type BigScreenModel = ReturnType<typeof useBigScreen>;
