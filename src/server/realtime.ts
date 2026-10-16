import * as Ably from 'ably';
import {
  CHANNELS,
  MODE_CHANGED,
  type ContentEventName,
  type ContentEvents,
  type ModeChangedData,
} from '@/lib/realtime/protocol';

// Server-side publishing over Ably REST. Each call is one HTTPS request made inside an
// API request that is already running, so realtime adds no Vercel invocations of its own.

const globalForAbly = globalThis as unknown as { ablyRest?: Ably.Rest };

export function getAblyRest(): Ably.Rest | null {
  const key = process.env.ABLY_ROOT_KEY;
  if (!key) return null;
  globalForAbly.ablyRest ??= new Ably.Rest({ key });
  return globalForAbly.ablyRest;
}

async function publish(channel: string, name: string, data: unknown) {
  const rest = getAblyRest();
  if (!rest) {
    console.warn(`[realtime] ABLY_ROOT_KEY is not set; skipped "${name}" on ${channel}`);
    return;
  }
  try {
    // Awaited on purpose: serverless functions may freeze as soon as the response is sent.
    await rest.channels.get(channel).publish(name, data);
  } catch (error) {
    // Never fail the user's save because realtime delivery failed.
    console.error(`[realtime] Failed to publish "${name}":`, error);
  }
}

export function publishContent<Name extends ContentEventName>(name: Name, data: ContentEvents[Name]) {
  return publish(CHANNELS.content, name, data);
}

export function publishModeChanged(data: ModeChangedData) {
  return publish(CHANNELS.control, MODE_CHANGED, data);
}
