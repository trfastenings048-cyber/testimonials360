'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Film, ImageIcon, Loader2, Volume2 } from 'lucide-react';
import { imageSrc } from '@/lib/image-urls';
import { BlurFillImage } from './BlurFillImage';
import { GroupChip } from './GroupChip';
import { SpeakerCard } from './SpeakerCard';
import { StageFrame } from './StageFrame';
import { StatusPill, type StatusPillState } from './StatusPill';
import { TestimonialCard } from './TestimonialCard';
import { useBigScreen, type SlideDirection } from './useBigScreen';
import { VideoStage } from './VideoStage';

const slideVariants = {
  enter: (direction: SlideDirection) => ({ x: direction === 'forward' ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: SlideDirection) => ({ x: direction === 'forward' ? '-100%' : '100%', opacity: 0 }),
};
const fadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

export default function BigScreen() {
  const screen = useBigScreen();
  const reduceMotion = useReducedMotion();
  const isVideo = screen.mode === 'video';

  // Local keyboard shortcuts for whoever is standing at the screen.
  const { showPreviousGroup, showNextGroup, toggleGroupPaused, toggleFullscreen, videoRef } = screen;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, video, [contenteditable="true"]')) return;
      if (event.key === 'f' || event.key === 'F') {
        void toggleFullscreen();
      } else if (event.key === ' ') {
        event.preventDefault();
        if (isVideo) {
          const element = videoRef.current;
          if (element) void (element.paused ? element.play().catch(() => undefined) : element.pause());
        } else {
          toggleGroupPaused();
        }
      } else if (!isVideo && event.key === 'ArrowLeft') {
        showPreviousGroup();
      } else if (!isVideo && event.key === 'ArrowRight') {
        showNextGroup();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isVideo, showPreviousGroup, showNextGroup, toggleGroupPaused, toggleFullscreen, videoRef]);

  if (screen.isLoading) {
    return (
      <div className="theme-display flex min-h-screen flex-col items-center justify-center gap-4 bg-display-bg font-display text-display-ink">
        <Loader2 className="size-12 animate-spin text-display-quote-to" />
        <p className="text-lg font-medium tracking-wide">Getting the big screen ready…</p>
      </div>
    );
  }

  const statusState: StatusPillState =
    screen.connection === 'offline'
      ? 'offline'
      : (isVideo ? !screen.isVideoPlaying : screen.isPaused)
        ? 'paused'
        : 'live';
  const groupCount = screen.groupImages.length;
  const fallbackTitle = screen.currentImage?.groupName || 'Sanitation Sandbox';

  return (
    <div className="theme-display grid h-screen w-full grid-rows-[minmax(0,1fr)_auto] gap-[1.6vh] overflow-hidden bg-display-bg p-[2.2vw] font-display text-display-ink select-none">
      <StageFrame>
        {isVideo ? (
          <VideoStage
            video={screen.video}
            videoRef={screen.videoRef}
            autoPlay={screen.videoAutoplay}
            loop={screen.videoLoop}
            muted={!screen.audioUnlocked}
            onPlayingChange={screen.setIsVideoPlaying}
          />
        ) : (
          <AnimatePresence initial={false} custom={screen.direction}>
            {screen.currentImage ? (
              <motion.div
                key={screen.currentImage.id}
                custom={screen.direction}
                variants={reduceMotion ? fadeVariants : slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <BlurFillImage
                  src={imageSrc(screen.currentImage, 'full')}
                  alt={`${screen.currentImage.groupName} group`}
                />
              </motion.div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1.2vh] text-center">
                <ImageIcon className="size-[clamp(32px,2.6vw,56px)] text-display-ink/70" strokeWidth={1.5} aria-hidden="true" />
                <p className="text-[clamp(16px,1.4vw,28px)] font-medium">Waiting for group photos…</p>
                <p className="text-[clamp(11px,0.85vw,16px)] text-display-muted">
                  New uploads appear here automatically.
                </p>
              </div>
            )}
          </AnimatePresence>
        )}

        {/* Top overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-[1.4vw]">
          <div className="pointer-events-auto">
            <StatusPill state={statusState} liveLabel={isVideo ? 'Playing' : undefined} />
          </div>
          {!isVideo && screen.currentImage && (
            <GroupChip name={screen.currentImage.groupName} index={screen.currentImageIndex} count={groupCount} />
          )}
        </div>

        {/* No on-screen controls: the screen is driven from /admin/control (or the keyboard). */}
        {isVideo && screen.video && !screen.audioUnlocked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[4%] z-10 flex justify-center">
            <div className="display-shadow flex items-center gap-2 rounded-full bg-white/90 px-[1.4vw] py-[0.8vw] text-[clamp(12px,0.95vw,18px)] font-medium backdrop-blur-md">
              <Volume2 className="size-[1.2em]" aria-hidden="true" /> Tap the screen once to turn on sound
            </div>
          </div>
        )}
      </StageFrame>

      {isVideo ? (
        <div className="display-shadow flex items-center gap-[1vw] rounded-[24px] bg-white px-[1.7vw] py-[1.8vh]">
          <span className="flex size-[clamp(26px,2.1vw,40px)] shrink-0 items-center justify-center rounded-full bg-display-ink text-white">
            <Film className="size-[45%]" aria-hidden="true" />
          </span>
          <span className="shrink-0 text-[clamp(11px,0.85vw,16px)] text-display-muted">Now playing</span>
          <span className="truncate text-[clamp(16px,1.4vw,28px)] font-medium">
            {screen.video?.title ?? 'No video selected'}
          </span>
        </div>
      ) : (
        <div className="grid h-[24vh] grid-cols-[1.85fr_1fr] gap-[1.4vw]">
          <TestimonialCard
            testimonial={screen.currentTestimonial}
            next={screen.nextTestimonial}
            fallbackTitle={fallbackTitle}
          />
          <SpeakerCard
            testimonial={screen.currentTestimonial}
            next={screen.nextTestimonial}
            fallbackTitle={fallbackTitle}
          />
        </div>
      )}
    </div>
  );
}
