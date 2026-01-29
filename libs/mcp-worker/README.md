# @mcp-fe/mcp-worker

The core package of the MCP-FE (Model Context Protocol - Frontend Edge) ecosystem. This library provides a browser-based MCP server implementation using Web Workers, enabling AI agents to query real-time frontend application state and user interaction data.

## Overview

`@mcp-fe/mcp-worker` turns your browser into an active, queryable MCP node by running MCP server endpoints in a Web Worker. It bridges the gap between AI agents and the live state of your frontend application, making runtime data accessible through standard MCP tools.

### Key Features

- **Browser-based MCP Server**: Full MCP server implementation running in Web Workers
- **Dual Worker Support**: Uses SharedWorker (preferred) with ServiceWorker fallback
- **IndexedDB Storage**: Persistent storage for user events and application state
- **WebSocket Transport**: Real-time connection to MCP proxy servers
- **Zero Backend Dependencies**: Runs entirely in the browser
- **Authentication Support**: Built-in token-based authentication
- **Connection Management**: Automatic reconnection and status monitoring

## Architecture

The package implements a **Worker-as-MCP-Edge-Server** pattern:

```
Frontend App ←→ WorkerClient ←→ Web Worker (MCP Server) ←→ WebSocket ←→ MCP Proxy ←→ AI Agent
```

1. **Frontend App**: Uses `workerClient` to send events and queries
2. **WorkerClient**: Manages worker lifecycle and provides clean API
3. **Web Worker**: Implements MCP server endpoints, stores data in IndexedDB
4. **WebSocket**: Maintains persistent connection to MCP proxy server
5. **MCP Proxy**: Bridges browser worker with external AI agents
6. **AI Agent**: Queries frontend state using standard MCP tools

## Installation

```bash
npm install @mcp-fe/mcp-worker
# or
pnpm add @mcp-fe/mcp-worker
# or
yarn add @mcp-fe/mcp-worker
```

## Quick Start

### 1. Copy Worker Files to Public Directory

The package exports pre-built worker scripts that must be accessible from your web server:

```bash
# Copy worker files to your public directory
cp node_modules/@mcp-fe/mcp-worker/mcp-shared-worker.js public/
cp node_modules/@mcp-fe/mcp-worker/mcp-service-worker.js public/
```

For build tools like Vite, Webpack, or Nx, you can configure them to copy these files automatically:

**Vite example:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  // ... other config
  publicDir: 'public',
  build: {
    rollupOptions: {
      // Copy worker files during build
      external: ['@mcp-fe/mcp-worker/mcp-*.js']
    }
  }
});
```

### 2. Initialize in Your Application

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

// Initialize the worker client
async function initMCP() {
  try {
    await workerClient.init({
      sharedWorkerUrl: '/mcp-shared-worker.js',    // optional, default value
      serviceWorkerUrl: '/mcp-service-worker.js',  // optional, default value  
      backendWsUrl: 'ws://localhost:3001'          // your MCP proxy server
    });
    
    console.log('MCP Worker initialized successfully');
  } catch (error) {
    console.error('Failed to initialize MCP Worker:', error);
  }
}

// Call during app startup
initMCP();
```

### 3. Set Authentication Token (Optional)

```typescript
// Set authentication token for user-specific data
workerClient.setAuthToken('Bearer your-jwt-token-here');

// Or queue the token before initialization
workerClient.setAuthToken('Bearer token');
await workerClient.init(/* options */);
```

## API Reference

### WorkerClient

The main singleton instance for communicating with the MCP worker.

#### `workerClient.init(options?)`

Initializes the worker client with optional configuration.

**Parameters:**
- `options?: WorkerClientInitOptions | ServiceWorkerRegistration`

**WorkerClientInitOptions:**
```typescript
interface WorkerClientInitOptions {
  sharedWorkerUrl?: string;    // Default: '/mcp-shared-worker.js'
  serviceWorkerUrl?: string;   // Default: '/mcp-service-worker.js'  
  backendWsUrl?: string;       // Default: 'ws://localhost:3001'
}
```

**Examples:**
```typescript
// Basic initialization with defaults
await workerClient.init();

// Custom configuration
await workerClient.init({
  backendWsUrl: 'wss://my-mcp-proxy.com/ws',
  sharedWorkerUrl: '/workers/mcp-shared-worker.js'
});

// Use existing ServiceWorker registration
const registration = await navigator.serviceWorker.register('/mcp-service-worker.js');
await workerClient.init(registration);
```

#### `workerClient.post(type, payload?)`

Send a fire-and-forget message to the worker.

**Parameters:**
- `type: string` - Message type
- `payload?: Record<string, unknown>` - Message payload

**Example:**
```typescript
// Store a user event
await workerClient.post('STORE_EVENT', {
  event: {
    type: 'click',
    element: 'button',
    elementText: 'Submit Form',
    path: '/checkout',
    timestamp: Date.now()
  }
});
```

#### `workerClient.request(type, payload?, timeoutMs?)`

Send a request expecting a response via MessageChannel.

**Parameters:**
- `type: string` - Request type  
- `payload?: Record<string, unknown>` - Request payload
- `timeoutMs?: number` - Timeout in milliseconds (default: 5000)

**Returns:** `Promise<T>` - Response data

**Example:**
```typescript
// Get stored events
const response = await workerClient.request('GET_EVENTS', {
  type: 'click',
  limit: 10
});

console.log('Recent clicks:', response.events);
```

#### `workerClient.setAuthToken(token)`

Set authentication token for the current session.

**Parameters:**
- `token: string` - Authentication token (e.g., JWT)

**Example:**
```typescript
// Set token after user login
workerClient.setAuthToken('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...');

// Clear token on logout  
workerClient.setAuthToken('');
```

#### `workerClient.getConnectionStatus()`

Get current connection status to the MCP proxy server.

**Returns:** `Promise<boolean>` - Connection status

**Example:**
```typescript
const isConnected = await workerClient.getConnectionStatus();
console.log('MCP connection:', isConnected ? 'Connected' : 'Disconnected');
```

#### Connection Status Events

Subscribe to connection status changes:

```typescript
// Listen for connection changes
const handleConnectionChange = (connected: boolean) => {
  console.log('Connection status changed:', connected);
};

workerClient.onConnectionStatus(handleConnectionChange);

// Stop listening
workerClient.offConnectionStatus(handleConnectionChange);
```

## Worker Implementation Details

### SharedWorker vs ServiceWorker

**SharedWorker (Preferred):**
- Single instance shared across all browser windows/tabs on the same origin
- Maintains persistent WebSocket connection even when tabs are closed
- Better for multi-tab applications
- Supported in Chrome, Firefox, and Safari

**ServiceWorker (Fallback):**
- Runs in background with browser-managed lifecycle
- Automatic fallback when SharedWorker is unavailable
- Handles offline scenarios and background sync
- Universal browser support

The `WorkerClient` automatically chooses the best available option.

### Data Storage

Events are stored in IndexedDB with the following schema:

```typescript
interface UserEvent {
  id: string;
  type: 'navigation' | 'click' | 'input' | 'custom';
  timestamp: number;
  path?: string;
  from?: string;          // navigation: previous route
  to?: string;            // navigation: current route  
  element?: string;       // interaction: element tag
  elementId?: string;     // interaction: element ID
  elementClass?: string;  // interaction: element classes
  elementText?: string;   // interaction: element text content
  metadata?: Record<string, unknown>;
}
```

### MCP Tools Exposed

The worker exposes these MCP tools to AI agents:

- `get_user_events` - Query stored user interaction events
- `get_connection_status` - Check WebSocket connection status
- `get_session_info` - Get current session information

## Advanced Usage

### Custom Event Storage

```typescript
// Store custom business events
await workerClient.post('STORE_EVENT', {
  event: {
    type: 'custom',
    timestamp: Date.now(),
    metadata: {
      eventName: 'purchase_completed',
      orderId: '12345',
      amount: 99.99,
      currency: 'USD'
    }
  }
});
```

### Querying Specific Events

```typescript
// Get navigation events from the last hour
const response = await workerClient.request('GET_EVENTS', {
  type: 'navigation',
  startTime: Date.now() - (60 * 60 * 1000),
  limit: 50
});

// Get clicks on specific elements
const clicks = await workerClient.request('GET_EVENTS', {
  type: 'click',
  path: '/checkout',
  limit: 20
});
```

### Error Handling

```typescript
try {
  await workerClient.init();
} catch (error) {
  if (error.message.includes('SharedWorker')) {
    console.log('SharedWorker not supported, falling back to ServiceWorker');
  } else {
    console.error('Worker initialization failed:', error);
  }
}

// Handle request timeouts
try {
  const data = await workerClient.request('GET_EVENTS', {}, 2000); // 2s timeout
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Request timed out, worker may be busy');
  }
}
```

## Integration with Higher-Level Libraries

This package is designed to be used with higher-level integration libraries:

- **[@mcp-fe/event-tracker](../event-tracker/README.md)**: Framework-agnostic event tracking
- **[@mcp-fe/react-event-tracker](../react-event-tracker/README.md)**: React-specific hooks and components

**Example with event-tracker:**
```typescript
import { initEventTracker, trackEvent } from '@mcp-fe/event-tracker';

// Initialize (uses @mcp-fe/mcp-worker internally)
await initEventTracker({
  backendWsUrl: 'ws://localhost:3001'
});

// Track events (stored via mcp-worker)
await trackEvent({
  type: 'click',
  element: 'button',
  elementText: 'Save Changes'
});
```

## Setting Up MCP Proxy Server

The worker connects to an MCP proxy server that bridges browser workers with AI agents. You need a Node.js MCP proxy running to use this package effectively.

### Using the Official Docker Image

The easiest way to run the MCP proxy server is using the official Docker image:

```bash
# Pull and run the MCP proxy server
docker pull ghcr.io/mcp-fe/mcp-fe/mcp-server:main
docker run -p 3001:3001 ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

The server will be available at `ws://localhost:3001` for your frontend applications.


**With Environment Variables:**
```bash
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

### Development Setup

For development, you can run the proxy server from source:

```bash
# Clone the MCP-FE repository
git clone https://github.com/mcp-fe/mcp-fe.git
cd mcp-fe

# Install dependencies
pnpm install

# Start the MCP proxy server
nx serve mcp-server
```

The proxy server handles:
- WebSocket connections from browser workers
- MCP protocol message routing
- Tool call forwarding between AI agents and frontend applications
- Connection management and error handling

See the [mcp-server documentation](../../apps/mcp-server/README.md) and main [MCP-FE documentation](../../README.md) for complete proxy server setup and configuration options.

## Browser Compatibility

- **Chrome/Chromium**: Full support (SharedWorker + ServiceWorker)
- **Firefox**: Full support (SharedWorker + ServiceWorker) 
- **Safari**: SharedWorker support, ServiceWorker fallback
- **Edge**: Full support (Chromium-based)

**Minimum Requirements:**
- ES2020+ support
- WebWorker support
- IndexedDB support
- WebSocket support (for MCP proxy connection)

## Troubleshooting

### Worker Files Not Found (404)

**Problem**: `Failed to load worker script` errors

**Solution**: 
1. Ensure worker files are copied to your public directory
2. Verify the URLs match your server configuration
3. Check browser Network tab for 404 errors

```typescript
// Custom paths if needed
await workerClient.init({
  sharedWorkerUrl: '/assets/workers/mcp-shared-worker.js',
  serviceWorkerUrl: '/assets/workers/mcp-service-worker.js'
});
```

### Connection Issues

**Problem**: `getConnectionStatus()` returns `false`

**Solution**:
1. Verify MCP proxy server is running on the specified URL
2. Check WebSocket connection in browser Developer Tools
3. Verify CORS settings if proxy is on different origin

### SharedWorker Not Working

**Problem**: Falls back to ServiceWorker unexpectedly

**Solution**:
1. SharedWorker requires HTTPS in production
2. Some browsers disable SharedWorker in private/incognito mode
3. Enterprise browser policies may block SharedWorker


## Related Packages

- **[Main MCP-FE Project](../../README.md)**: Complete documentation and examples
- **[@mcp-fe/event-tracker](../event-tracker/README.md)**: Framework-agnostic event tracking API
- **[@mcp-fe/react-event-tracker](../react-event-tracker/README.md)**: React integration hooks

## License

Licensed under the Apache License, Version 2.0. See the [LICENSE](../../LICENSE) file for details.

---

**Note**: This package is the foundational layer of the MCP-FE ecosystem. For most applications, consider using the higher-level integration packages like `@mcp-fe/react-event-tracker` which provide a more convenient API.
