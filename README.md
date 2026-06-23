# Real-Time Replicator

A NestJS service that polls multiple external APIs for configurable data layers, optionally deduplicates payloads via content hashing, and broadcasts changes to WebSocket clients in real time.

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
| Optional unchanged broadcast skipping | Per-layer SHA-256 hash comparison before publish |
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
    ├── config/
    ├── fetchers/
    │   ├── layer-data-fetcher.interface.ts
    │   ├── layer-data-fetcher.registry.ts
    │   ├── roads-layer-fetcher.service.ts
    │   ├── weather-layer-fetcher.service.ts
    │   └── vehicles-layer-fetcher.service.ts
    ├── store/
    ├── types/
    ├── utils/
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
| `LAYERS` | mock `roads`, `weather`, and `vehicles` layers | JSON array of layer configs |
| `LAYER_ROADS_URL` | `http://localhost:4001/mock/roads` | Roads layer upstream URL |
| `LAYER_ROADS_API_KEY` | unset | Optional roads layer bearer token |
| `LAYER_WEATHER_URL` | `http://localhost:4001/graphql` | Weather GraphQL upstream URL |
| `LAYER_WEATHER_API_KEY` | unset | Optional weather layer bearer token |
| `LAYER_WEATHER_STABLE` | `false` | Ask the mock weather GraphQL API for unchanged data |
| `LAYER_VEHICLES_URL` | `http://localhost:4001/mock/vehicles` | Vehicles layer upstream URL |
| `LAYER_VEHICLES_API_KEY` | unset | Optional vehicles layer bearer token |

Example:

```bash
LAYERS='[
  {"id":"roads","intervalMs":10000,"enabled":true,"changeDetection":true,"retryCount":3,"retryIntervalMs":3000},
  {"id":"weather","intervalMs":50000,"enabled":true,"changeDetection":true,"retryCount":3,"retryIntervalMs":3000},
  {"id":"vehicles","intervalMs":10000,"enabled":true,"changeDetection":false,"retryCount":3,"retryIntervalMs":3000}
]'
```

Layer URLs, API keys, headers, request params, and response quirks belong in each layer-specific fetcher service. `LAYERS` controls polling behavior and must use ids that have registered fetchers.

`changeDetection` defaults to `true`. When it is `true`, unchanged payloads are skipped using a SHA-256 hash comparison. When it is `false`, every successful poll writes the latest snapshot to Redis and publishes an update.

`retryCount` defaults to `3` and controls how many times a failed fetch is retried after the initial attempt. `retryIntervalMs` defaults to `3000` and controls the delay between those retry attempts. Each failed fetch attempt is logged.

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
| `POST /graphql` | Returns weather stations through the `weather` GraphQL query |
| `GET /mock/vehicles` | Returns vehicle positions with random coordinates |

Add `?stable=true` to REST endpoints, or send `{"variables":{"stable":true}}` to GraphQL, to return unchanged data (useful for testing hash dedup).

Weather GraphQL example:

```graphql
query WeatherLayer($stable: Boolean) {
  weather(stable: $stable) {
    layerId
    version
    timestamp
    features {
      id
      condition
      temperatureC
      humidity
      windSpeedKmh
    }
  }
}
```

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

Create a service that implements `LayerDataFetcher`, register it in `LayerModule`, then add an entry to the `LAYERS` environment variable using the same `layerId`.

```bash
LAYERS='[
  {"id":"traffic","intervalMs":3000,"enabled":true,"changeDetection":true}
]'
```

The poller and gateway will automatically pick up registered, enabled layers on restart.

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
