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

interface GraphqlRequest {
  query?: unknown;
  variables?: {
    stable?: unknown;
  };
}

function readJsonBody(req: http.IncomingMessage): Promise<GraphqlRequest> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body) as GraphqlRequest);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getWeatherData(stable: boolean): unknown {
  if (stable) {
    return stableSnapshots.weather;
  }

  counters.weather = (counters.weather ?? 0) + 1;
  return generateWeather(counters.weather);
}

function writeJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const stable = url.searchParams.get('stable') === 'true';

  if (pathname === '/graphql') {
    if (req.method !== 'POST') {
      writeJson(res, 405, { errors: [{ message: 'Method not allowed' }] });
      return;
    }

    try {
      const requestBody = await readJsonBody(req);
      const query = typeof requestBody.query === 'string' ? requestBody.query : '';

      if (!query.includes('weather')) {
        writeJson(res, 400, {
          errors: [{ message: 'Only the weather query is supported.' }],
        });
        return;
      }

      writeJson(res, 200, {
        data: {
          weather: getWeatherData(requestBody.variables?.stable === true),
        },
      });
    } catch (error) {
      writeJson(res, 400, {
        errors: [
          {
            message: `Invalid GraphQL request: ${(error as Error).message}`,
          },
        ],
      });
    }

    return;
  }

  // Match /mock/:layerId
  const match = pathname.match(/^\/mock\/(roads|vehicles)$/);

  if (!match) {
    writeJson(res, 404, { error: 'Not found', path: pathname });
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

  writeJson(res, 200, data);
});

server.listen(PORT, () => {
  console.log(`\n🧪 Mock API server running on http://localhost:${PORT}`);
  console.log(`\n   Endpoints:`);
  console.log(`     GET /mock/roads`);
  console.log(`     POST /graphql (weather query)`);
  console.log(`     GET /mock/vehicles`);
  console.log(
    `\n   Add ?stable=true to REST endpoints or { "variables": { "stable": true } } to GraphQL to return unchanged data.\n`,
  );
});
