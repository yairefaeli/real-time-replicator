import http from 'node:http';

const PORT = 4001;

// ---------------------------------------------------------------------------
// Counters — incremented on each request to produce changing data
// ---------------------------------------------------------------------------
const counters: Record<string, number> = {
  roads: 0,
  weather: 0,
  vehicles: 0,
};

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRoads(version: number) {
  const statuses = ['open', 'blocked', 'construction', 'open', 'open'] as const;
  return {
    layerId: 'roads',
    version,
    timestamp: Date.now(),
    features: Array.from({ length: 5 }, (_, i) => ({
      id: `road-${i + 1}`,
      status: statuses[randomBetween(0, statuses.length - 1)],
      speed: randomBetween(0, 120),
    })),
  };
}

function generateWeather(version: number) {
  const conditions = ['sunny', 'cloudy', 'rainy', 'stormy', 'foggy'] as const;
  return {
    layerId: 'weather',
    version,
    timestamp: Date.now(),
    features: Array.from({ length: 3 }, (_, i) => ({
      id: `station-${i + 1}`,
      condition: conditions[randomBetween(0, conditions.length - 1)],
      temperatureC: randomBetween(-10, 42),
      humidity: randomBetween(20, 100),
      windSpeedKmh: randomBetween(0, 80),
    })),
  };
}

function generateVehicles(version: number) {
  const types = ['car', 'truck', 'bus', 'motorcycle', 'van'] as const;
  return {
    layerId: 'vehicles',
    version,
    timestamp: Date.now(),
    features: Array.from({ length: 8 }, (_, i) => ({
      id: `vehicle-${i + 1}`,
      type: types[randomBetween(0, types.length - 1)],
      lat: 32.0 + Math.random() * 0.5,
      lng: 34.7 + Math.random() * 0.5,
      speed: randomBetween(0, 160),
    })),
  };
}

// Stable snapshots — generated once, reused when ?stable=true
const stableSnapshots: Record<string, unknown> = {
  roads: generateRoads(0),
  weather: generateWeather(0),
  vehicles: generateVehicles(0),
};

const generators: Record<string, (v: number) => unknown> = {
  roads: generateRoads,
  weather: generateWeather,
  vehicles: generateVehicles,
};

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const stable = url.searchParams.get('stable') === 'true';

  // Match /mock/:layerId
  const match = pathname.match(/^\/mock\/(roads|weather|vehicles)$/);

  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: pathname }));
    return;
  }

  const layerId = match[1]!;

  let data: unknown;
  if (stable) {
    data = stableSnapshots[layerId];
  } else {
    counters[layerId] = (counters[layerId] ?? 0) + 1;
    data = generators[layerId]!(counters[layerId]!);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
});

server.listen(PORT, () => {
  console.log(`\n🧪 Mock API server running on http://localhost:${PORT}`);
  console.log(`\n   Endpoints:`);
  console.log(`     GET /mock/roads`);
  console.log(`     GET /mock/weather`);
  console.log(`     GET /mock/vehicles`);
  console.log(`\n   Add ?stable=true to return unchanged data.\n`);
});
