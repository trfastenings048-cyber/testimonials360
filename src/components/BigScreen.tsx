'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { fetchCertificates, fetchImages, CertificateRecord } from '@/lib/api';
import { imagePreviewSrc } from '@/lib/image-urls';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { EventImage } from '@/types';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
} from 'lucide-react';

const GROUP_DURATION = 8000;
const TESTIMONIAL_DURATION = 5000;
const PROGRESS_STEP = 50;

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

function QrCard({ certificateUrl }: { certificateUrl: string }) {
  return (
    <div
      data-testid="qr-card"
      className="qr-card flex w-[clamp(7rem,13vw,15rem)] shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border-2 border-[#00a9b7] bg-white p-2 shadow-2xl backdrop-blur-sm transition-transform duration-300 hover:scale-[1.02] sm:gap-2  md:p-3 xl:p-4  2xl:border-4 2xl:p-5"
    >
      <div className="qr-card-copy shrink-0 text-center">
        <p className="text-xs font-black leading-tight text-[#111111] xl:text-sm 2xl:text-lg">GET YOUR</p>
        <p className="mb-1 text-xs font-black leading-tight text-[#00a9b7] xl:text-sm 2xl:text-lg">PHOTOGRAPH</p>
        <p className="text-[8px] uppercase tracking-wider text-[#111111]/60 xl:text-[10px] 2xl:text-xs">Scan to Claim</p>
      </div>
      <div className="aspect-square w-full rounded-lg bg-white p-1">
        <QRCodeSVG value={certificateUrl} className="h-full w-full" level="H" />
      </div>
    </div>
  );
}

export default function BigScreen() {
  const [images, setImages] = useState<EventImage[]>([]);
  const [testimonials, setTestimonials] = useState<CertificateRecord[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const [certificateUrl, setCertificateUrl] = useState('/certificate');

  useEffect(() => {
    setCertificateUrl(`${window.location.origin}/certificate`);
  }, []);

  useEffect(() => {
    const loadImages = async (focusImageId?: string) => {
      try {
        const fetchedImages = await fetchImages(true);
        setImages(fetchedImages);
        const focusImage =
          (focusImageId && fetchedImages.find((image) => image.id === focusImageId)) || fetchedImages[0];
        if (focusImage) {
          const nextGroupImages = getDisplayGroupImages(fetchedImages);
          const focusGroupKey = normalizeGroupName(focusImage.groupName);
          const focusGroupIndex = nextGroupImages.findIndex(
            (image) => normalizeGroupName(image.groupName) === focusGroupKey
          );
          if (focusGroupIndex >= 0) {
            setDirection('forward');
            setCurrentImageIndex(focusGroupIndex);
            setProgress(0);
          }
        }
      } catch (error) {
        console.error('Error loading group images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const loadTestimonials = async (focusCertificateId?: string) => {
      try {
        const certificates = await fetchCertificates(true);
        const nextTestimonials = certificates.filter(
          (certificate) =>
            certificate.userEmail !== 'system-intro@gates.com' &&
            Boolean(certificate.feedback?.trim())
        );
        setTestimonials(nextTestimonials);
        if (nextTestimonials.length > 0) {
          const focusIndex = focusCertificateId
            ? nextTestimonials.findIndex((certificate) => certificate.id === focusCertificateId)
            : 0;
          setCurrentTestimonialIndex(focusIndex >= 0 ? focusIndex : 0);
        }
      } catch (error) {
        console.error('Error loading testimonials:', error);
      }
    };

    // Initial load.
    void loadImages();
    void loadTestimonials();

    // 1. Real-time cross-device notification stream (Server-Sent Events)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/stream');
      eventSource.addEventListener('update', (message) => {
        let event: { type?: string; imageId?: string; certificateId?: string };
        try {
          event = JSON.parse(message.data || '{}') as {
            type?: string;
            imageId?: string;
            certificateId?: string;
          };
        } catch {
          return;
        }
        if (event.type === 'certificate-submitted') {
          void loadTestimonials(event.certificateId);
          return;
        }
        if (event.type === 'content-updated') {
          void loadImages(event.imageId);
          void loadTestimonials();
        }
      });
      eventSource.onerror = (err) => {
        console.warn('SSE stream error, EventSource will automatically reconnect:', err);
      };
    } catch (err) {
      console.warn('Failed to initialize EventSource:', err);
    }

    // 2. Local tab notification channel (instant same-device sync)
    const channel = new BroadcastChannel('gates360-events');
    channel.addEventListener('message', (event) => {
      if (event.data?.type === 'certificate-submitted') {
        void loadTestimonials(event.data?.certificateId);
      } else if (event.data?.type === 'content-updated') {
        void loadImages(event.data?.imageId);
        void loadTestimonials();
      }
    });

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      channel.close();
    };
  }, []);

  const groupImages = useMemo(() => {
    return getDisplayGroupImages(images);
  }, [images]);

  useEffect(() => {
    if (currentImageIndex >= groupImages.length) {
      setCurrentImageIndex(0);
      setProgress(0);
    }
  }, [currentImageIndex, groupImages.length]);

  const currentImage = groupImages[currentImageIndex] ?? null;

  const currentTestimonial = testimonials[currentTestimonialIndex] ?? null;

  useEffect(() => {
    if (currentTestimonialIndex >= testimonials.length) {
      setCurrentTestimonialIndex(0);
    }
  }, [currentTestimonialIndex, testimonials.length]);

  // Testimonials rotate independently and intentionally have no playback controls.
  useEffect(() => {
    if (testimonials.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentTestimonialIndex((index) => (index + 1) % testimonials.length);
    }, TESTIMONIAL_DURATION);

    return () => window.clearInterval(interval);
  }, [testimonials.length]);

  const showNextGroup = () => {
    if (groupImages.length === 0) return;
    setDirection('forward');
    setCurrentImageIndex((index) => (index + 1) % groupImages.length);
    setProgress(0);
  };

  const showPreviousGroup = () => {
    if (groupImages.length === 0) return;
    setDirection('backward');
    setCurrentImageIndex((index) => (index - 1 + groupImages.length) % groupImages.length);
    setProgress(0);
  };

  // Playback controls affect only the upper group-image card.
  useEffect(() => {
    if (isPaused || groupImages.length <= 1) return;

    const interval = window.setInterval(() => {
      setProgress((currentProgress) =>
        Math.min(100, currentProgress + (PROGRESS_STEP / GROUP_DURATION) * 100)
      );
    }, PROGRESS_STEP);

    return () => window.clearInterval(interval);
  }, [groupImages.length, isPaused]);

  // Advance once the progress bar fills. Kept out of the setProgress updater, which React
  // may call twice (Strict Mode) and would skip a slide — with 2 groups it never moved.
  useEffect(() => {
    if (progress < 100 || groupImages.length <= 1) return;
    setDirection('forward');
    setCurrentImageIndex((index) => (index + 1) % groupImages.length);
    setProgress(0);
  }, [progress, groupImages.length]);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
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

      {/* Full-screen group slideshow; testimonial and QR are overlaid on top of it. */}
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
                src={imagePreviewSrc(currentImage.id)}
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
          <div
            style={{ width: `${progress}%` }}
            className="h-full bg-[#00a9b7] transition-all duration-75 ease-linear"
          />
        </div>

        {/* Overlay row: testimonial on the left, QR on the right. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
          {/* Frosted white review card, 40% wide, text aligned left. */}
          <div className="pointer-events-auto relative w-[40%] min-w-0 overflow-hidden rounded-xl border border-white/60 border-l-[6px] border-l-[#00a9b7] bg-white/60 px-5 py-4 text-left text-[#111111] shadow-2xl backdrop-blur-xl sm:px-8 sm:py-6">
            <AnimatePresence mode="wait">
              {currentTestimonial ? (
                <motion.div
                  key={currentTestimonial.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.45 }}
                >
                  <p className="text-sm font-medium italic leading-relaxed text-[#111111] sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl">
                    “{currentTestimonial.feedback}”
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-2">
                    <span className="text-xs font-bold uppercase text-[#032b69] sm:text-sm md:text-base lg:text-lg xl:text-xl">
                      {currentTestimonial.userName || 'Anonymous'}
                    </span>
                    <span className="text-xs text-[#111111]/30">|</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#111111]/70 md:text-sm lg:text-base xl:text-lg">
                      {[currentTestimonial.designation, currentTestimonial.teamName]
                        .filter(Boolean)
                        .join(' at ') || 'Participant'}
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

          <div className="pointer-events-auto">
            <QrCard certificateUrl={certificateUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
