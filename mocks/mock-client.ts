import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';
const LAYERS_TO_SUBSCRIBE = ['roads', 'weather', 'vehicles'];
const UNSUBSCRIBE_AFTER_MS = 20_000;
const LAYER_TO_UNSUBSCRIBE = 'roads';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function ts(): string {
  return new Date().toISOString();
}

function logEvent(event: string, data: unknown): void {
  console.log(`\n[${ts()}] 📨 ${event}`);
  console.log(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const socket: Socket = io(SERVER_URL, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log(`\n[${ts()}] ✅ Connected to ${SERVER_URL} (id: ${socket.id})`);

  for (const layerId of LAYERS_TO_SUBSCRIBE) {
    console.log(`[${ts()}] ➡️  Subscribing to layer: ${layerId}`);
    socket.emit('layer.subscribe', { layerId });
  }

  // Unsubscribe from one layer after the configured delay
  setTimeout(() => {
    console.log(
      `\n[${ts()}] ⏱️  ${UNSUBSCRIBE_AFTER_MS / 1000}s elapsed — unsubscribing from "${LAYER_TO_UNSUBSCRIBE}"`,
    );
    socket.emit('layer.unsubscribe', { layerId: LAYER_TO_UNSUBSCRIBE });
  }, UNSUBSCRIBE_AFTER_MS);
});

// --- Layer events ---

socket.on('layer.snapshot', (data: unknown) => {
  logEvent('layer.snapshot', data);
});

socket.on('layer.updated', (data: unknown) => {
  logEvent('layer.updated', data);
});

socket.on('layer.error', (data: unknown) => {
  logEvent('layer.error', data);
});

// --- Connection lifecycle ---

socket.on('disconnect', (reason: string) => {
  console.log(`\n[${ts()}] ❌ Disconnected: ${reason}`);
});

socket.on('connect_error', (err: Error) => {
  console.error(`\n[${ts()}] 🔴 Connection error: ${err.message}`);
});

// Keep process alive
process.on('SIGINT', () => {
  console.log(`\n[${ts()}] 🛑 Shutting down client…`);
  socket.disconnect();
  process.exit(0);
});
