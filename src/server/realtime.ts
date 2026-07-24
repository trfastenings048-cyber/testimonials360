import pg from 'pg';

type Client = ReadableStreamDefaultController<Uint8Array>;

const encoder = new TextEncoder();
const clients = new Set<Client>();
const channelName = 'gates360_events';
const databaseUrl = process.env.DATABASE_URL;
const notifyPool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : null;

export function addSseClient(controller: Client) {
  clients.add(controller);
  controller.enqueue(encoder.encode(': connected\n\n'));

  let pgClient: pg.Client | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let isClosed = false;

  const enqueue = (message: Uint8Array) => {
    try {
      controller.enqueue(message);
    } catch {
      isClosed = true;
    }
  };

  pingTimer = setInterval(() => {
    enqueue(encoder.encode(': ping\n\n'));
  }, 30000);

  if (databaseUrl) {
    pgClient = new pg.Client({ connectionString: databaseUrl });
    pgClient.on('notification', (message) => {
      if (isClosed || message.channel !== channelName || !message.payload) return;
      enqueue(encoder.encode(`event: update\ndata: ${message.payload}\n\n`));
    });
    pgClient.on('error', (error) => {
      console.error('Realtime notification listener error:', error);
    });
    void pgClient
      .connect()
      .then(() => pgClient?.query(`LISTEN ${channelName}`))
      .catch((error) => {
        console.error('Failed to initialize realtime notification listener:', error);
      });
  }

  return () => {
    isClosed = true;
    clients.delete(controller);
    if (pingTimer) clearInterval(pingTimer);
    void pgClient?.end().catch(() => undefined);
  };
}

export function broadcastUpdate(type: string, payload: Record<string, unknown> = {}) {
  const eventPayload = JSON.stringify({ type, ...payload });

  if (notifyPool) {
    void notifyPool.query('select pg_notify($1, $2)', [channelName, eventPayload]).catch((error) => {
      console.error('Failed to publish realtime update:', error);
    });
  }

  const message = encoder.encode(`event: update\ndata: ${eventPayload}\n\n`);

  for (const client of Array.from(clients)) {
    try {
      client.enqueue(message);
    } catch {
      clients.delete(client);
    }
  }
}
