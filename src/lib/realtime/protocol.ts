// Single source of truth for realtime channel names, message names and payloads.
// Shared by the display, the admin and the server so the strings can't drift.

import type { CertificateRecord, EventImage } from '@/types';

export const CHANNELS = {
  /** Admin → screens commands, plus screen presence (live state). Never persisted. */
  control: 'display:control',
  /** Server → everyone: content changes carrying the changed record. */
  content: 'display:content',
} as const;

export type RealtimeRole = 'display' | 'admin';

// ---------------------------------------------------------------------------
// Commands (display:control)
// ---------------------------------------------------------------------------

export const COMMANDS = [
  'testimonials.next',
  'testimonials.previous',
  'testimonials.pause',
  'testimonials.play',
  'banner.next',
  'banner.previous',
  'banner.pause',
  'banner.play',
  'video.play',
  'video.pause',
  'video.next',
  'video.previous',
] as const;
export type CommandName = (typeof COMMANDS)[number];

export type CommandData = { id: string; issuedAt: number };

/** Published by the server after it saves the display mode / video. */
export const MODE_CHANGED = 'mode.changed';

export type DisplayMode = 'testimonials' | 'video';

export type DisplayVideo = { id: string; url: string; title: string };

/** "single" plays the latest standalone upload; "parts" plays the ordered clip set. */
export type VideoSetKind = 'single' | 'parts';

/** Videos that belong to the clip playlist share this `setName`. */
export const PARTS_SET_NAME = 'tr-fastening-parts';

export type ModeChangedData = {
  mode: DisplayMode;
  /** First item of `playlist`; kept so screens running an older build still play something. */
  video: DisplayVideo | null;
  /** What video mode plays, in order: one item for "single", the clips for "parts". */
  playlist: DisplayVideo[];
  videoSet: VideoSetKind;
  videoAutoplay: boolean;
  videoLoop: boolean;
  testimonialAutoPlay: boolean;
  testimonialDurationMs: number;
};

export const isCommandName = (name: unknown): name is CommandName =>
  typeof name === 'string' && (COMMANDS as readonly string[]).includes(name);

export const isModeChangedData = (data: unknown): data is ModeChangedData => {
  const mode = (data as Partial<ModeChangedData> | null)?.mode;
  return mode === 'testimonials' || mode === 'video';
};

// ---------------------------------------------------------------------------
// Presence (display:control) — each screen's live state, updated only on change
// ---------------------------------------------------------------------------

export type ScreenState = {
  mode: DisplayMode;
  testimonials: { paused: boolean; index: number; count: number };
  /** The group-photo slideshow behind the testimonial card. Optional: older screens don't report it. */
  banner?: { paused: boolean; index: number; count: number; groupName: string | null };
  video: {
    id: string | null;
    title: string | null;
    playing: boolean;
    /** Position in the playlist. Optional: older screens don't report it. */
    index?: number;
    count?: number;
    set?: VideoSetKind;
  };
  /** False until someone interacts with the screen once; browsers mute autoplay until then. */
  audioUnlocked: boolean;
};

export type ScreenPresence = ScreenState & { clientId: string };

export const isScreenState = (data: unknown): data is ScreenState => {
  const value = data as ScreenState | null;
  return Boolean(value?.testimonials) && Boolean(value?.video) && typeof value?.mode === 'string';
};

// ---------------------------------------------------------------------------
// Content deltas (display:content)
// ---------------------------------------------------------------------------

export type VideoContent = {
  id: string;
  title: string;
  url: string;
  createdAt: string | Date;
};

/** Database rows use null where the client types use optional fields. */
export type Nullable<T> = { [K in keyof T]: undefined extends T[K] ? T[K] | null : T[K] };
export type TestimonialContent = Nullable<CertificateRecord>;

export type ContentEvents = {
  'testimonial.submitted': TestimonialContent;
  'testimonial.updated': TestimonialContent;
  'testimonial.deleted': { ids: string[] };
  'testimonials.cleared': Record<string, never>;
  'image.updated': EventImage;
  'image.deleted': { id: string };
  'video.created': VideoContent;
  'video.deleted': { id: string };
};
export type ContentEventName = keyof ContentEvents;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

const CLIENT_ID_PATTERN = /^(display|admin)-[a-z0-9-]{6,48}$/;

export const isValidClientId = (role: RealtimeRole, clientId: string) =>
  CLIENT_ID_PATTERN.test(clientId) && clientId.startsWith(`${role}-`);

/** Random id that works on plain-http LAN addresses, where crypto.randomUUID is unavailable. */
export const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
