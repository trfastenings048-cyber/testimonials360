'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as Ably from 'ably';
import {
  CHANNELS,
  isScreenState,
  randomId,
  type RealtimeRole,
  type ScreenPresence,
  type ScreenState,
} from './protocol';

export type RealtimeConnection = 'connecting' | 'live' | 'reconnecting' | 'offline';

export function mapConnectionState(state: Ably.ConnectionState): RealtimeConnection {
  switch (state) {
    case 'connected':
      return 'live';
    case 'disconnected':
      return 'reconnecting';
    case 'suspended':
    case 'failed':
    case 'closing':
    case 'closed':
      return 'offline';
    default:
      return 'connecting';
  }
}

const CLIENT_ID_KEY = 'tr-realtime-client-id';

/** Stable per tab, so a screen keeps its identity (and presence slot) across reloads. */
function tabClientId(role: RealtimeRole) {
  const key = `${CLIENT_ID_KEY}:${role}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = `${role}-${randomId()}`;
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `${role}-${randomId()}`;
  }
}

/**
 * One Ably connection per tab, authenticated with a role-scoped token from our API
 * (renewed by the SDK roughly every 12 hours). Nothing here polls.
 */
export function useRealtimeClient(role: RealtimeRole) {
  const [client] = useState<Ably.Realtime | null>(() => {
    if (typeof window === 'undefined') return null;
    const clientId = tabClientId(role);
    return new Ably.Realtime({
      authUrl: '/api/realtime/token',
      authParams: { role, clientId },
      clientId,
      autoConnect: false,
      // Admins don't need their own commands echoed back.
      echoMessages: role === 'display',
    });
  });

  const subscribe = useCallback(
    (notify: () => void) => {
      if (!client) return () => undefined;
      client.connection.on(notify);
      return () => client.connection.off(notify);
    },
    [client]
  );
  const connection = useSyncExternalStore<RealtimeConnection>(
    subscribe,
    () => (client ? mapConnectionState(client.connection.state) : 'connecting'),
    () => 'connecting'
  );

  useEffect(() => {
    if (!client) return;
    client.connect();
    return () => client.close();
  }, [client]);

  return { client, connection };
}

/** Subscribes to every message on a channel for the lifetime of the component. */
export function useChannelMessages(
  client: Ably.Realtime | null,
  channelName: string,
  onMessage: (message: Ably.InboundMessage) => void
) {
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    if (!client) return;
    const channel = client.channels.get(channelName);
    const listener = (message: Ably.InboundMessage) => handlerRef.current(message);
    channel.subscribe(listener).catch((error) => console.error(`[realtime] subscribe ${channelName} failed`, error));
    return () => channel.unsubscribe(listener);
  }, [client, channelName]);
}

/**
 * Display side: enter presence once, then push `state` only when `version` changes,
 * so routine auto-rotation never generates messages. Ably re-enters automatically
 * after a reconnect.
 */
export function useScreenPresence(client: Ably.Realtime | null, state: ScreenState, version: string) {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    if (!client) return;
    const presence = client.channels.get(CHANNELS.control).presence;
    presence.enter(stateRef.current).catch((error) => console.error('[realtime] presence enter failed', error));
    return () => {
      presence.leave().catch(() => undefined);
    };
  }, [client]);

  const isFirstVersion = useRef(true);
  useEffect(() => {
    if (!client) return;
    if (isFirstVersion.current) {
      isFirstVersion.current = false;
      return;
    }
    client.channels
      .get(CHANNELS.control)
      .presence.update(stateRef.current)
      .catch((error) => console.error('[realtime] presence update failed', error));
  }, [client, version]);
}

/** Admin side: the live list of connected screens and their reported state. */
export function useScreens(client: Ably.Realtime | null): ScreenPresence[] {
  const [screens, setScreens] = useState<ScreenPresence[]>([]);

  useEffect(() => {
    if (!client) return;
    const presence = client.channels.get(CHANNELS.control).presence;
    let cancelled = false;

    // presence.get() reads the locally synced member set; no extra network round trip.
    const refresh = () => {
      presence
        .get()
        .then((members) => {
          if (cancelled) return;
          setScreens(
            members
              .filter((member) => member.clientId?.startsWith('display-') && isScreenState(member.data))
              .map((member) => ({ ...(member.data as ScreenState), clientId: member.clientId }))
              .sort((a, b) => a.clientId.localeCompare(b.clientId))
          );
        })
        .catch((error) => console.error('[realtime] presence get failed', error));
    };

    presence.subscribe(refresh).then(refresh).catch((error) => console.error('[realtime] presence subscribe failed', error));
    return () => {
      cancelled = true;
      presence.unsubscribe(refresh);
    };
  }, [client]);

  return screens;
}
