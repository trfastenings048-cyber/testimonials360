'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type * as Ably from 'ably';
import { toast } from 'sonner';
import { fetchCertificates, fetchDisplaySettings, fetchImages, type DisplaySettings } from '@/lib/api';
import { CHANNELS, randomId, type CommandName, type ContentEvents, type ModeChangedData, type ScreenPresence } from '@/lib/realtime/protocol';
import { useChannelMessages, useRealtimeClient, useScreens, type RealtimeConnection } from '@/lib/realtime/client';
import type { CertificateRecord, EventImage } from '@/types';

export type ConnectionStatus = RealtimeConnection;

export const SYSTEM_INTRO_EMAIL = 'system-intro@gates.com';

export const defaultDisplaySettings: DisplaySettings = {
  id: 'default',
  heading: 'Testimonials',
  subtitle: '',
  mode: 'testimonials',
  videoUrl: null,
  videoAutoplay: true,
  videoLoop: true,
  testimonialAutoPlay: true,
  testimonialDurationMs: 5000,
  video: null,
  videoSet: 'single',
  playlist: [],
};

type AdminData = {
  images: EventImage[];
  setImages: Dispatch<SetStateAction<EventImage[]>>;
  imagesLoading: boolean;
  certificates: CertificateRecord[];
  setCertificates: Dispatch<SetStateAction<CertificateRecord[]>>;
  certificatesLoading: boolean;
  settings: DisplaySettings;
  setSettings: Dispatch<SetStateAction<DisplaySettings>>;
  /** Ably connection state for this admin tab. */
  connection: ConnectionStatus;
  /** Big screens currently connected, with the state each one reports via presence. */
  screens: ScreenPresence[];
  realtime: Ably.Realtime | null;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  /** Sends a playback command straight to the screens over Ably (no API call). */
  publishCommand: (name: CommandName) => Promise<void>;
};

const AdminDataContext = createContext<AdminData | null>(null);

export function useAdminData() {
  const value = useContext(AdminDataContext);
  if (!value) throw new Error('useAdminData must be used inside <AdminDataProvider>');
  return value;
}

const upsertById = <T extends { id: string }>(items: T[], item: T, sort: (a: T, b: T) => number) =>
  [...items.filter((existing) => existing.id !== item.id), item].sort(sort);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<EventImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [certificatesLoading, setCertificatesLoading] = useState(true);
  const [settings, setSettings] = useState<DisplaySettings>(defaultDisplaySettings);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { client: realtime, connection } = useRealtimeClient('admin');
  const screens = useScreens(realtime);

  const loadAll = useCallback(() => {
    const imagesRequest = fetchImages()
      .then(setImages)
      .catch(() => toast.error('Failed to load content library'))
      .finally(() => setImagesLoading(false));
    const certificatesRequest = fetchCertificates()
      .then(setCertificates)
      .catch(() => toast.error('Failed to load submissions'))
      .finally(() => setCertificatesLoading(false));
    const settingsRequest = fetchDisplaySettings()
      .then(setSettings)
      .catch(() => toast.error('Using default display settings; the API is unavailable'));
    return Promise.all([imagesRequest, certificatesRequest, settingsRequest]).then(() => undefined);
  }, []);

  // One load per admin session; everything after this arrives over Ably.
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAll]);

  // Ably resumes short drops without losing messages; after a suspension, resync once.
  useEffect(() => {
    if (!realtime) return;
    const onChange = (change: Ably.ConnectionStateChange) => {
      if (change.current === 'connected' && change.previous === 'suspended') void loadAll();
    };
    realtime.connection.on(onChange);
    return () => realtime.connection.off(onChange);
  }, [realtime, loadAll]);

  useChannelMessages(realtime, CHANNELS.content, (message) => {
    const byNewestCert = (a: CertificateRecord, b: CertificateRecord) => b.createdAt - a.createdAt;
    const byNewestImage = (a: EventImage, b: EventImage) => b.timestamp - a.timestamp;

    switch (message.name) {
      case 'testimonial.submitted':
      case 'testimonial.updated': {
        const record = message.data as ContentEvents['testimonial.updated'] as CertificateRecord;
        setCertificates((current) => upsertById(current, record, byNewestCert));
        if (message.name === 'testimonial.submitted') {
          toast.info(`New submission from ${record.userName}`, { description: 'Waiting for review in Testimonials.' });
        }
        break;
      }
      case 'testimonial.deleted': {
        const { ids } = message.data as ContentEvents['testimonial.deleted'];
        setCertificates((current) => current.filter((item) => !ids.includes(item.id)));
        break;
      }
      case 'testimonials.cleared':
        setCertificates([]);
        break;
      case 'image.updated':
        setImages((current) => upsertById(current, message.data as EventImage, byNewestImage));
        break;
      case 'image.deleted': {
        const { id } = message.data as ContentEvents['image.deleted'];
        setImages((current) => current.filter((item) => item.id !== id));
        break;
      }
    }
  });

  // Keep this tab's copy of the settings in step with mode changes made elsewhere.
  useChannelMessages(realtime, CHANNELS.control, (message) => {
    if (message.name !== 'mode.changed') return;
    const data = message.data as ModeChangedData;
    setSettings((current) => ({
      ...current,
      mode: data.mode,
      video: data.video,
      playlist: data.playlist ?? current.playlist,
      videoSet: data.videoSet ?? current.videoSet,
      videoUrl: data.videoSet === 'parts' ? current.videoUrl : (data.video?.url ?? null),
    }));
  });

  const publishCommand = useCallback(
    async (name: CommandName) => {
      if (!realtime) throw new Error('Realtime is not ready');
      await realtime.channels.get(CHANNELS.control).publish(name, { id: randomId(), issuedAt: Date.now() });
    },
    [realtime]
  );

  const value = useMemo<AdminData>(
    () => ({
      images,
      setImages,
      imagesLoading,
      certificates,
      setCertificates,
      certificatesLoading,
      settings,
      setSettings,
      connection,
      screens,
      realtime,
      isRefreshing,
      refresh,
      publishCommand,
    }),
    [
      images,
      imagesLoading,
      certificates,
      certificatesLoading,
      settings,
      connection,
      screens,
      realtime,
      isRefreshing,
      refresh,
      publishCommand,
    ]
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

/** Testimonials = submissions with feedback text, excluding the seeded intro record. */
export function isTestimonial(certificate: CertificateRecord) {
  return certificate.userEmail !== SYSTEM_INTRO_EMAIL && Boolean(certificate.feedback?.trim());
}
