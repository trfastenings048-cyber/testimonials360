'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ImageIcon, Loader2 } from 'lucide-react';
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
  const { showPreviousGroup, showNextGroup, showPreviousClip, showNextClip, toggleGroupPaused, toggleFullscreen, videoRef } = screen;
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
      } else if (event.key === 'ArrowLeft') {
        if (isVideo) showPreviousClip();
        else showPreviousGroup();
      } else if (event.key === 'ArrowRight') {
        if (isVideo) showNextClip();
        else showNextGroup();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isVideo, showPreviousGroup, showNextGroup, showPreviousClip, showNextClip, toggleGroupPaused, toggleFullscreen, videoRef]);

  if (screen.isLoading) {
    return (
      <div className="theme-display flex min-h-screen flex-col items-center justify-center gap-4 bg-display-bg font-display text-display-ink">
        <Loader2 className="size-12 animate-spin text-display-quote-to" />
        <p className="text-lg font-medium tracking-wide">Getting the big screen ready…</p>
      </div>
    );
  }

  const statusState: StatusPillState =
    screen.connection === 'offline' ? 'offline' : screen.isPaused ? 'paused' : 'live';
  const groupCount = screen.groupImages.length;
  const fallbackTitle = screen.currentImage?.groupName || 'Sanitation Sandbox';

  // Video mode is just the video, edge to edge: no frame, status pill, captions or footer.
  if (isVideo) {
    // A tap also enters browser fullscreen (it needs a gesture), alongside unlocking sound.
    return (
      <div
        className="theme-display fixed inset-0 cursor-none overflow-hidden bg-black select-none"
        onClick={() => {
          if (!screen.isFullscreen) void screen.toggleFullscreen();
        }}
      >
        <VideoStage
          video={screen.video}
          videoRef={screen.videoRef}
          autoPlay={screen.videoAutoplay}
          loop={screen.videoLoop}
          muted={screen.videoMuted || !screen.audioUnlocked}
          nextVideo={screen.nextVideo}
          onPlayingChange={screen.setIsVideoPlaying}
          onEnded={screen.handleVideoEnded}
        />
      </div>
    );
  }

  return (
    <div className="theme-display grid h-screen w-full grid-rows-[minmax(0,1fr)_auto] gap-[1.6vh] overflow-hidden bg-display-bg p-[2.2vw] font-display text-display-ink select-none">
      <StageFrame>
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

        {/* Top overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-[1.4vw]">
          <div className="pointer-events-auto">
            <StatusPill state={statusState} />
          </div>
          {screen.currentImage && (
            <GroupChip name={screen.currentImage.groupName} index={screen.currentImageIndex} count={groupCount} />
          )}
        </div>

        {/* No on-screen controls: the screen is driven from /admin/control (or the keyboard). */}
      </StageFrame>

      <div className="grid h-[24vh] grid-cols-[1.85fr_1fr] gap-[1.4vw]">
          <TestimonialCard
            testimonial={screen.currentTestimonial}
            fallbackTitle={fallbackTitle}
          />
          <SpeakerCard
            testimonial={screen.currentTestimonial}
            next={screen.nextTestimonial}
            fallbackTitle={fallbackTitle}
          />
      </div>
    </div>
  );
}
