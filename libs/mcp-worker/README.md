# @mcp-fe/mcp-worker

This library provides a client adapter and ready-to-use worker scripts for working with MCP (Model Context Protocol).

Exports

- `index` — the main client module (exports the `workerClient` singleton and related types). Import this in your client application.
- `mcp-service-worker.js` — Service Worker implementation intended to be registered via `navigator.serviceWorker.register(...)`.
- `mcp-shared-worker.js` — SharedWorker implementation intended to be started via `new SharedWorker(...)`.

Note: Worker script files (service/shared) must be available on your application's public path so the browser can fetch them (for example `/mcp-service-worker.js` and `/mcp-shared-worker.js`).

Quick start

1) Make worker files available on your public path

- Copy the worker files (`mcp-service-worker.js`, `mcp-shared-worker.js`) into the folder your webserver serves as public (for example `public/` or `dist/`).
- Important: the URL used during registration must match the actual location of the files. The `WorkerClient` defaults to `/mcp-shared-worker.js` and `/mcp-service-worker.js`. 
  If you place them elsewhere, pass the correct URLs to `init`.

3) Import and initialize in your client app

Example (TypeScript):

```ts
import { workerClient } from '@mcp-fe/mcp-worker';

// Optionally provide custom worker URLs and backend WebSocket URL
await workerClient.init({
  sharedWorkerUrl: '/mcp-shared-worker.js',
  serviceWorkerUrl: '/mcp-service-worker.js',
  backendWsUrl: 'wss://your-backend.example/ws'
});

// Set an auth token (if you use authentication)
workerClient.setAuthToken('Bearer ...');

// Send an event to the worker (fire-and-forget)
await workerClient.post('STORE_EVENT', { event: { /* ... */ } });

// Request events (request/response)
const res = await workerClient.request('GET_EVENTS');
if (res && (res as any).events) {
  console.log('Events:', (res as any).events);
}
```

Alternatively, register the Service Worker yourself and pass the registration to `init`:

```ts
// register the service worker (e.g. in your app entry file)
const registration = await navigator.serviceWorker.register('/mcp-service-worker.js');
await workerClient.init(registration);
```

Notes & best practices

- `WorkerClient` prefers `SharedWorker` (shared across windows/iframes on the same origin). If `SharedWorker` is not available, it will automatically fall back to `ServiceWorker`.
- If you need different worker URLs, pass `sharedWorkerUrl` and `serviceWorkerUrl` to `workerClient.init(...)`.
- Worker scripts must be served from the same origin as your app.
- Calling `workerClient.setAuthToken(...)` before initialization is allowed: the client will queue the token and send it when a worker becomes available.
- The default worker URLs are `/mcp-shared-worker.js` and `/mcp-service-worker.js`.
