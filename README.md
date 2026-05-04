# Real-Time Replicator

A NestJS service that polls multiple external APIs for configurable data layers, deduplicates payloads via content hashing, and broadcasts changes to WebSocket clients in real time.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        External APIs                               │
│              /roads          /weather         /traffic             │
└──────┬───────────────┬───────────────┬────────────────────────────┘
       │               │               │
       ▼               ▼               ▼
┌────────────────────────────────────────────────────────────────────┐
│                     LayerPollerService                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│   │ timer()  │  │ timer()  │  │ timer()  │   Independent RxJS     │
│   │ roads    │  │ weather  │  │ traffic  │   streams per layer    │
│   │ 1000ms   │  │ 5000ms   │  │ 3000ms   │                       │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
│        │              │              │                             │
│   exhaustMap      exhaustMap     exhaustMap                        │
│   ┌────┴────┐    ┌────┴────┐    ┌────┴────┐                      │
│   │ lock?   │    │ lock?   │    │ lock?   │  Redis SET NX PX      │
│   │ fetch   │    │ fetch   │    │ fetch   │                       │
│   │ hash    │    │ hash    │    │ hash    │  SHA-256 dedup         │
│   │ publish │    │ publish │    │ publish │  Redis Pub/Sub         │
│   └─────────┘    └─────────┘    └─────────┘                       │
└────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                          Redis                                     │
│                                                                    │
│   layer:{id}:lock     Distributed lock (SET NX PX)                │
│   layer:{id}:latest   Latest snapshot (JSON)                      │
│   layer:{id}:hash     Content hash (SHA-256)                      │
│   layer:{id}:updates  Pub/Sub channel                             │
└────────────────────────┬──────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────┐
│                      LayerGateway                                  │
│                                                                    │
│   Subscribes to Redis Pub/Sub for all enabled layers              │
│   Broadcasts layer.updated to socket.io rooms                     │
│   Sends layer.snapshot on client subscribe                        │
│                                                                    │
│   Rooms: layer:{id}                                               │
└────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
                   WebSocket Clients
```

## Key Design Decisions

| Concern | Solution |
|---------|----------|
| One writer per layer | Redis distributed lock (`SET NX PX`) |
| No overlapping polls | `exhaustMap` in RxJS stream |
| Independent layers | Separate `timer()` stream per layer |
| No unchanged broadcasts | SHA-256 hash comparison before publish |
| Multi-pod broadcasting | Redis Pub/Sub → all pods receive updates |
| Graceful shutdown | `takeUntil(destroy$)` + `OnModuleDestroy` |
| Stream resilience | `catchError` inside projection — timer survives errors |

## Project Structure

```
src/
├── app.module.ts
├── main.ts
└── layers/
    ├── layer.module.ts
    ├── layer.types.ts
    ├── layer-config.service.ts
    ├── layer-hash.util.ts
    ├── external-layer-client.service.ts
    ├── layer-store.service.ts
    ├── layer-poller.service.ts
    └── layer-gateway.ts
mocks/
├── mock-api.ts              # Fake external API server
└── mock-client.ts           # WebSocket test client
```

## Getting Started

### Prerequisites

- Node.js ≥ 20
- Redis running locally (or configure `REDIS_HOST` / `REDIS_PORT`)

### Setup

```bash
cp .env.example .env
npm install
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP & WebSocket server port |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `LAYERS` | mock `roads` layer | JSON array of layer configs |

Example:

```bash
LAYERS='[
  {"id":"roads","url":"http://localhost:4001/mock/roads","intervalMs":10000,"enabled":true},
  {"id":"weather","url":"http://localhost:4001/mock/weather","intervalMs":50000,"enabled":true},
  {"id":"vehicles","url":"http://localhost:4001/mock/vehicles","intervalMs":10000,"enabled":true}
]'
```

## Local Development

Run the full stack locally with three terminal windows:

### Terminal 1 — Start Redis

```bash
redis-server
```

### Terminal 2 — Start the Mock API

```bash
npm run mock:api
```

This starts a fake external API on `http://localhost:4001` with endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /mock/roads` | Returns road features with random status/speed |
| `GET /mock/weather` | Returns weather stations with random conditions |
| `GET /mock/vehicles` | Returns vehicle positions with random coordinates |

Add `?stable=true` to any endpoint to return unchanged data (useful for testing hash dedup).

### Terminal 3 — Start the NestJS App

```bash
npm run start:dev
```

### Terminal 4 — Start the Mock Client

```bash
npm run mock:client
```

The client will:
1. Connect to `ws://localhost:3000`
2. Subscribe to `roads`, `weather`, and `vehicles` layers
3. Print all `layer.snapshot`, `layer.updated`, and `layer.error` events
4. Unsubscribe from `roads` after 20 seconds

## WebSocket Client Example

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  // Subscribe to a layer
  socket.emit("layer.subscribe", { layerId: "roads" });
});

// Receive the latest cached snapshot on subscribe
socket.on("layer.snapshot", (data) => {
  console.log("Snapshot:", data);
  // { layerId: "roads", data: { ... }, timestamp: "2026-05-03T..." }
});

// Receive real-time updates when data changes
socket.on("layer.updated", (data) => {
  console.log("Updated:", data);
  // { layerId: "roads", data: { ... }, timestamp: "2026-05-03T..." }
});

// Handle errors
socket.on("layer.error", (err) => {
  console.error("Error:", err);
  // { layerId: "roads", message: "Unknown layer: ..." }
});

// Unsubscribe from a layer
// socket.emit("layer.unsubscribe", { layerId: "roads" });
```

## Adding a New Layer

Add an entry to the `LAYERS` environment variable:

```bash
LAYERS='[
  {"id":"traffic","url":"https://example.com/traffic","intervalMs":3000,"enabled":true}
]'
```

The poller and gateway will automatically pick it up on restart.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start` | Start in production mode |
| `npm run start:dev` | Start with file watching |
| `npm run start:debug` | Start with debugger attached |
| `npm run build` | Compile TypeScript |
| `npm run lint` | Lint and auto-fix |
| `npm run test` | Run unit tests |
| `npm run mock:api` | Start mock external API on port 4001 |
| `npm run mock:client` | Start mock WebSocket test client |
