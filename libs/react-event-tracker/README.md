# @mcp-fe/react-event-tracker

React hooks for automatic tracking of user interactions and navigation events in React Router and TanStack Router applications.

## 📦 Overview

`@mcp-fe/react-event-tracker` provides specialized React hooks that automatically track navigation events in React applications. It works in conjunction with [`@mcp-fe/mcp-worker`](../mcp-worker/README.md) to provide a complete MCP-FE solution.

> **Note**: For MCP Tools integration (dynamic tool registration, handlers, etc.), please use [`@mcp-fe/react`](../react/README.md) instead. This package is specifically focused on event tracking.

### Key Features

- **Automatic Navigation Tracking**: Tracks route changes in React Router and TanStack Router
- **User Interaction Tracking**: Automatically tracks clicks, input changes, and other user interactions
- **Zero Configuration**: Works out-of-the-box with minimal setup
- **Authentication Support**: Built-in support for setting authentication tokens
- **Framework Agnostic Core**: Built on top of [`@mcp-fe/event-tracker`](../event-tracker/README.md)

## 📚 Related Packages

- **[`@mcp-fe/react`](../react/README.md)** - MCP Tools hooks and components for React (useMCPTool, MCPToolsProvider, etc.)
- **[`@mcp-fe/event-tracker`](../event-tracker/README.md)** - Core event tracking functionality
- **[`@mcp-fe/mcp-worker`](../mcp-worker/README.md)** - Worker-based MCP client implementation

## Installation

```bash
npm install @mcp-fe/react-event-tracker @mcp-fe/mcp-worker
# or
pnpm add @mcp-fe/react-event-tracker @mcp-fe/mcp-worker
# or
yarn add @mcp-fe/react-event-tracker @mcp-fe/mcp-worker
```

### Peer Dependencies

This package requires the following peer dependencies:

- React >=19.0.0
- React DOM >=19.0.0
- React Router DOM >=6.0.0 (for React Router integration)
- TanStack Router >=1.0.0 (for TanStack Router integration)

## Setup

Before using the React hooks, you need to:

1. **Copy worker files** to your public directory from `@mcp-fe/mcp-worker`
2. **Set up the MCP proxy server** (see [`@mcp-fe/mcp-worker` documentation](../mcp-worker/README.md))

## Usage

### React Router Integration

For applications using React Router, use the `useReactRouterEventTracker` hook:

```typescript
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';

function App() {
  const { setAuthToken } = useReactRouterEventTracker({
    backendWsUrl: 'ws://localhost:3001'
  });

  // Set authentication token when available
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
    }
  }, [setAuthToken]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        {/* Your other routes */}
      </Routes>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div>
      <h1>Welcome!</h1>
      <button onClick={() => alert('Clicked!')}>
        Click me (this click will be tracked)
      </button>
      <input 
        placeholder="Type here (input changes will be tracked)" 
        onChange={(e) => console.log(e.target.value)}
      />
    </div>
  );
}
```

### TanStack Router Integration

For applications using TanStack Router, use the `useTanstackRouterEventTracker` hook:

```typescript
import React, { useEffect } from 'react';
import { useTanstackRouterEventTracker } from '@mcp-fe/react-event-tracker';

function App() {
  const { setAuthToken } = useTanstackRouterEventTracker({
    backendWsUrl: 'ws://localhost:3001'
  });

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
    }
  }, [setAuthToken]);

  return (
    <div>
      {/* Your TanStack Router setup */}
      <h1>My TanStack Router App</h1>
      {/* Components and interactions will be automatically tracked */}
    </div>
  );
}
```

## Configuration Options

Both hooks accept optional configuration parameters:

```typescript
interface WorkerClientInitOptions {
  backendWsUrl?: string;        // WebSocket URL of your MCP proxy server
  workerPath?: string;          // Custom path to worker files
  fallbackToServiceWorker?: boolean; // Enable ServiceWorker fallback
}
```

### Example with custom configuration:

```typescript
const { setAuthToken } = useReactRouterEventTracker({
  backendWsUrl: 'wss://my-mcp-server.com/ws',
  workerPath: '/workers',
  fallbackToServiceWorker: true
});
```

## What Gets Tracked

The React event tracker automatically captures:

### Navigation Events
- Route changes (from previous route to current route)
- Page loads and refreshes

### User Interactions
- **Clicks**: Element tag, ID, class, text content (first 100 chars)
- **Input Changes**: Input/textarea changes (debounced by 1 second)
- **Form Interactions**: Button clicks, link clicks

### Event Data Structure

Each tracked event includes:

```typescript
interface UserEventData {
  type: 'navigation' | 'click' | 'input' | 'custom';
  path?: string;           // Current page path
  from?: string;           // Previous route (navigation only)
  to?: string;             // Current route (navigation only)
  element?: string;        // Element tag name
  elementId?: string;      // Element ID attribute
  elementClass?: string;   // Element class attribute
  elementText?: string;    // Element text content
  metadata?: Record<string, unknown>; // Additional data
  timestamp: number;       // Event timestamp
}
```

## Authentication

To associate tracked events with specific users, set an authentication token:

```typescript
const { setAuthToken } = useReactRouterEventTracker();

// When user logs in
const handleLogin = async (credentials) => {
  const response = await login(credentials);
  const token = response.token;
  
  // Store token for your app
  localStorage.setItem('authToken', token);
  
  // Set token for MCP tracking
  setAuthToken(token);
};

// When user logs out
const handleLogout = () => {
  localStorage.removeItem('authToken');
  setAuthToken(''); // Clear the token
};
```

## Integration with MCP Agents

Once events are being tracked, AI agents can query them through the MCP protocol:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_user_events",
    "arguments": {
      "type": "click",
      "limit": 10
    }
  }
}
```

This enables AI agents to:
- Debug user interface issues
- Provide context-aware customer support
- Analyze user behavior patterns
- Guide users through complex workflows

## Advanced Usage

### Custom Event Tracking

You can also track custom events alongside the automatic tracking:

```typescript
import { trackEvent } from '@mcp-fe/event-tracker';

// Track a custom business event
await trackEvent({
  type: 'custom',
  metadata: {
    eventName: 'purchase_completed',
    orderId: '12345',
    amount: 99.99
  }
});
```

### Connection Status Monitoring

Monitor the connection status to the MCP proxy server:

```typescript
import { getConnectionStatus, onConnectionStatus } from '@mcp-fe/event-tracker';

// Check current status
const isConnected = await getConnectionStatus();

// Listen for status changes
onConnectionStatus((connected) => {
  console.log('MCP connection:', connected ? 'Connected' : 'Disconnected');
});
```

## Requirements

- **MCP Worker**: This package requires [`@mcp-fe/mcp-worker`](../mcp-worker/README.md) to be properly set up
- **MCP Proxy Server**: You need a running MCP proxy server to collect the events
- **Public Worker Files**: Worker files must be accessible from your web server's public directory

## Troubleshooting

### Events Not Being Tracked

1. **Check worker initialization**: Ensure `@mcp-fe/mcp-worker` files are in your public directory
2. **Verify proxy connection**: Check that your MCP proxy server is running and accessible
3. **Check browser console**: Look for initialization errors or connection issues

### Navigation Not Tracked

1. **Router integration**: Ensure you're using the correct hook for your router (React Router vs TanStack Router)
2. **Hook placement**: Make sure the hook is called within the router context

### Authentication Issues

1. **Token format**: Ensure your authentication token is in the expected format
2. **Timing**: Set the auth token after both the tracker and your authentication system are initialized

## Examples

Check out the example application in the `apps/mcp-fe` directory for a complete working implementation.

## Related Packages

- [`@mcp-fe/mcp-worker`](../mcp-worker/README.md): Core MCP worker implementation
- [`@mcp-fe/event-tracker`](../event-tracker/README.md): Framework-agnostic event tracking library

## License

Licensed under the Apache License, Version 2.0. See the [LICENSE](../../LICENSE) file for details.

