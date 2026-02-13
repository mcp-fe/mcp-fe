# @mcp-fe/mcp-worker

Browser-based MCP server running in Web Workers. Connect AI agents directly to your frontend application state.

## What is MCP-FE Worker?

`@mcp-fe/mcp-worker` turns your browser into a queryable MCP server. It allows AI agents (like Claude) to:

- 🔍 Query user interactions in real-time
- 📊 Access application state directly
- 🎯 Register custom tools dynamically
- 💾 Store and retrieve events from IndexedDB

The MCP server runs in a Web Worker in your browser, requiring an MCP proxy server to bridge communication with AI agents.

## Key Concepts

### MCP Server in Browser

This library runs an **MCP server in your browser** using Web Workers, exposing frontend application context to AI agents. This enables AI agents to query live browser state (DOM, localStorage, React state, etc.) through the standard MCP protocol.

The key advantage is **making frontend context accessible** to AI agents without custom backend code for each use case.

### Dual Worker Strategy

The library uses **SharedWorker** (preferred) or **ServiceWorker** (fallback):

- **SharedWorker**: Single instance shared across tabs, persistent connection
- **ServiceWorker**: Universal browser support, automatic fallback

### Dynamic Tool Registration

Register custom MCP tools at runtime with **handlers running in the main thread**:

```typescript
await workerClient.registerTool(
  'get_user_data',
  'Get current user information',
  { type: 'object', properties: {} },
  async () => {
    const user = getCurrentUser(); // Full browser access!
    return {
      content: [{ type: 'text', text: JSON.stringify(user) }]
    };
  }
);
```

Handlers have full access to:
- ✅ React context, hooks, state
- ✅ DOM API, localStorage
- ✅ All imports and dependencies
- ✅ Closures and external variables

## Architecture

```
Frontend App ←→ WorkerClient ←→ Web Worker ←→ WebSocket ←→ MCP Proxy ←→ AI Agent
                                    ↓
                                IndexedDB
```

1. **Frontend App** - Your application
2. **WorkerClient** - Simple API for worker communication
3. **Web Worker** - MCP server running in background
4. **WebSocket** - Real-time connection to proxy
5. **MCP Proxy** - Bridges browser with AI agents
6. **AI Agent** - Queries your app via MCP protocol

### Project Structure

The library is organized into three main directories:

```
libs/mcp-worker/src/
├── client/              # Client-side code (application runtime)
│   ├── worker-client.ts # Main WorkerClient class
│   └── index.ts         # Client API exports
├── worker/              # Worker-side code (background processing)
│   ├── mcp-controller.ts    # MCP server controller
│   ├── mcp-server.ts        # MCP server setup
│   ├── tab-manager.ts       # Multi-tab coordination
│   ├── tool-registry.ts     # Dynamic tool management
│   └── built-in-tools.ts    # Default MCP tools
└── shared/              # Shared code (both contexts)
    ├── types.ts         # TypeScript type definitions
    ├── logger.ts        # Logging utilities
    └── database.ts      # IndexedDB operations
```

**Entry points:**
- `mcp-shared-worker.ts` - SharedWorker implementation (preferred)
- `mcp-service-worker.ts` - ServiceWorker fallback

## Quick Start

### Installation

```bash
npm install @mcp-fe/mcp-worker
# or
pnpm add @mcp-fe/mcp-worker
```

### 1. Setup Worker Files

Copy worker scripts to your public directory:

```bash
cp node_modules/@mcp-fe/mcp-worker/mcp-shared-worker.js public/
cp node_modules/@mcp-fe/mcp-worker/mcp-service-worker.js public/
```

### 2. Initialize

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

await workerClient.init({
  backendWsUrl: 'ws://localhost:3001' // Your MCP proxy URL
});
```

### 3. Store Events

```typescript
await workerClient.post('STORE_EVENT', {
  event: {
    type: 'click',
    element: 'button',
    elementText: 'Submit',
    timestamp: Date.now()
  }
});
```

### 4. Register Custom Tools

```typescript
await workerClient.registerTool(
  'get_todos',
  'Get all todos',
  { type: 'object', properties: {} },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(todos) }]
  })
);
```

**That's it!** AI agents can now query your app via MCP protocol.

## Documentation

### Core Documentation

- **[Quick Start Guide](./docs/guide.md)** - Complete guide to dynamic tool registration
- **[API Reference](./docs/api.md)** - Full API documentation
- **[Project Structure](./docs/project-structure.md)** - Codebase organization explained
- **[Worker Details](./docs/worker-details.md)** - Implementation details
- **[Architecture](./docs/architecture.md)** - How the proxy pattern works
- **[Initialization](./docs/initialization.md)** - Init queue handling

### Examples

- **[Quick Start Examples](./examples/quick-start.ts)** - 4 simple examples
- **[Advanced Examples](./examples/dynamic-tools.ts)** - Validation, async, error handling
- **[Examples Guide](./examples/README.md)** - How to use examples

### React Integration

- **[React Hooks Guide](../react-event-tracker/REACT_MCP_TOOLS.md)** - React integration
- **[React Examples](../react-event-tracker/src/examples/ReactMCPToolsExamples.tsx)** - Component examples

## Common Use Cases

### Track User Interactions

```typescript
// Clicks, navigation, form inputs
await workerClient.post('STORE_EVENT', {
  event: { type: 'click', element: 'button', ... }
});
```

### Expose Application State

```typescript
await workerClient.registerTool('get_cart', 'Get shopping cart', ..., 
  async () => ({ content: [{ type: 'text', text: JSON.stringify(cart) }] })
);
```

### Query Stored Events

```typescript
const events = await workerClient.request('GET_EVENTS', {
  type: 'navigation',
  limit: 50
});
```

### Monitor Connection Status

```typescript
const connected = await workerClient.getConnectionStatus();
workerClient.onConnectionStatus((connected) => {
  console.log('MCP connection:', connected);
});
```

## MCP Proxy Server

The worker connects to an MCP proxy server that bridges browser with AI agents.

### Using Docker (Recommended)

```bash
docker pull ghcr.io/mcp-fe/mcp-fe/mcp-server:main
docker run -p 3001:3001 ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

Server available at `ws://localhost:3001`

### Development

```bash
git clone https://github.com/mcp-fe/mcp-fe.git
cd mcp-fe
pnpm install
nx serve mcp-server
```

See [mcp-server docs](../../apps/mcp-server/README.md) for complete setup.

## Features

### Dynamic Tool Registration

Register custom MCP tools at runtime:

```typescript
await workerClient.registerTool(
  'get_user_data',
  'Get current user information',
  { type: 'object', properties: {} },
  async () => {
    const user = getCurrentUser(); // Full browser access!
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(user)
      }]
    };
  }
);
```

**Learn more:**
- [Guide](./docs/guide.md) - Complete step-by-step guide
- [Quick Start Examples](./examples/quick-start.ts) - Ready-to-use examples
- [Advanced Examples](./examples/dynamic-tools.ts) - Validation, async, error handling
- [React Integration](../react-event-tracker/REACT_MCP_TOOLS.md) - React hooks

### Event Storage

Store and query user interactions:

```typescript
// Store event
await workerClient.post('STORE_EVENT', {
  event: { type: 'click', element: 'button', ... }
});

// Query events
const events = await workerClient.request('GET_EVENTS', {
  type: 'click',
  limit: 10
});
```

### Connection Management

Monitor MCP proxy connection:

```typescript
const connected = await workerClient.getConnectionStatus();
workerClient.onConnectionStatus((connected) => {
  console.log('Status:', connected);
});
```

## Browser Compatibility

- ✅ **Chrome/Chromium 80+** - Full support
- ✅ **Firefox 78+** - Full support
- ✅ **Safari 16.4+** - Full support
- ✅ **Edge 80+** - Full support (Chromium-based)

**Requirements:** ES2020+, WebWorker, IndexedDB, WebSocket

See [Worker Details](./docs/worker-details.md) for more information.

## Troubleshooting

### Worker files not found (404)

Ensure worker files are in your public directory and paths match:

```typescript
await workerClient.init({
  sharedWorkerUrl: '/path/to/mcp-shared-worker.js',
  serviceWorkerUrl: '/path/to/mcp-service-worker.js'
});
```

### Connection issues

1. Verify MCP proxy server is running
2. Check WebSocket connection in DevTools Network tab
3. Verify CORS settings if on different origin

### SharedWorker not available

SharedWorker requires HTTPS in production and may be blocked in incognito mode. The library automatically falls back to ServiceWorker.

**For more help:** See [Worker Details](./docs/worker-details.md#troubleshooting)

## Related Packages

- [Main MCP-FE Project](../../README.md) - Complete documentation
- [@mcp-fe/event-tracker](../event-tracker/README.md) - Framework-agnostic event tracking
- [@mcp-fe/react-event-tracker](../react-event-tracker/README.md) - React integration hooks

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](../../LICENSE) for details.

---

**For most applications, consider using [@mcp-fe/react-event-tracker](../react-event-tracker/README.md) for a more convenient React-focused API.**
