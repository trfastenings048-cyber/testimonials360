import type { RefObject } from 'react';
import { Film } from 'lucide-react';
import type { DisplayVideo } from '@/lib/realtime/protocol';

/** Video mode: the configured video plays inside the stage frame. */
export function VideoStage({
  video,
  videoRef,
  autoPlay,
  loop,
  muted,
  onPlayingChange,
}: {
  video: DisplayVideo | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  autoPlay: boolean;
  loop: boolean;
  muted: boolean;
  onPlayingChange: (playing: boolean) => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-display-ink">
      {video ? (
        <video
          key={video.url}
          ref={videoRef}
          className="h-full w-full object-contain"
          src={video.url}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          playsInline
          onPlay={() => onPlayingChange(true)}
          onPause={() => onPlayingChange(false)}
          onEnded={() => onPlayingChange(false)}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 text-center text-white">
          <Film className="size-14 text-brand-teal-bright" aria-hidden="true" />
          <p className="text-lg font-medium">No video configured</p>
        </div>
      )}
    </div>
  );
}
