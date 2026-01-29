# @mcp-fe/event-tracker

Framework-agnostic event tracking library for the MCP-FE (Model Context Protocol - Frontend Edge) ecosystem. This library provides a simple, clean API for tracking user interactions and making them available to AI agents through the MCP protocol.

## Overview

`@mcp-fe/event-tracker` is a lightweight wrapper around [`@mcp-fe/mcp-worker`](../mcp-worker/README.md) that provides an ergonomic API for tracking user events in any JavaScript application. It serves as the foundation for framework-specific integrations like [`@mcp-fe/react-event-tracker`](../react-event-tracker/README.md).

### Key Features

- **Framework Agnostic**: Works with any JavaScript framework or vanilla JS
- **Simple API**: Clean, intuitive functions for common tracking needs
- **Rich Event Data**: Captures element details, metadata, and context
- **Connection Management**: Built-in WebSocket connection status monitoring
- **Authentication Support**: Token-based authentication for user-specific events
- **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install @mcp-fe/event-tracker
# or
pnpm add @mcp-fe/event-tracker
# or
yarn add @mcp-fe/event-tracker
```

### Dependencies

This package requires [`@mcp-fe/mcp-worker`](../mcp-worker/README.md) which is automatically installed as a dependency. Make sure to set up the worker files as described in the mcp-worker documentation.

## Quick Start

```typescript
import { 
  initEventTracker, 
  trackEvent, 
  trackNavigation, 
  trackClick 
} from '@mcp-fe/event-tracker';

// Initialize the event tracker
await initEventTracker({
  backendWsUrl: 'ws://localhost:3001'
});

// Track user interactions
await trackNavigation('/home', '/products');
await trackClick(document.getElementById('buy-button'));

// Track custom events
await trackEvent({
  type: 'custom',
  metadata: {
    eventName: 'purchase_completed',
    orderId: '12345',
    amount: 99.99
  }
});
```

## API Reference

### Initialization

#### `initEventTracker(options?)`

Initialize the event tracking system. This sets up the underlying MCP worker.

**Parameters:**
- `options?: ServiceWorkerRegistration | WorkerClientInitOptions`

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
// Basic initialization
await initEventTracker();

// With custom WebSocket URL
await initEventTracker({
  backendWsUrl: 'wss://my-mcp-server.com/ws'
});

// With custom worker paths
await initEventTracker({
  sharedWorkerUrl: '/assets/workers/mcp-shared-worker.js',
  backendWsUrl: 'ws://localhost:3001'
});

// Using existing ServiceWorker registration
const registration = await navigator.serviceWorker.register('/mcp-service-worker.js');
await initEventTracker(registration);
```

### Event Tracking

#### `trackEvent(eventData)`

Track a generic user event with custom data.

**Parameters:**
- `eventData: UserEventData`

**UserEventData Interface:**
```typescript
interface UserEventData {
  type: 'navigation' | 'click' | 'input' | 'custom';
  path?: string;           // Current page path
  from?: string;           // Previous location (navigation events)
  to?: string;             // Next location (navigation events)
  element?: string;        // HTML element tag name
  elementId?: string;      // Element ID attribute
  elementClass?: string;   // Element CSS classes
  elementText?: string;    // Element text content (truncated to 100 chars)
  metadata?: Record<string, unknown>; // Additional event data
}
```

**Example:**
```typescript
await trackEvent({
  type: 'custom',
  path: '/dashboard',
  metadata: {
    eventName: 'feature_used',
    feature: 'export_data',
    format: 'csv',
    recordCount: 150
  }
});
```

#### `trackNavigation(from, to, path?)`

Track navigation between routes or pages.

**Parameters:**
- `from: string` - Previous route/URL
- `to: string` - Current route/URL  
- `path?: string` - Optional explicit path (defaults to `to`)

**Example:**
```typescript
// Basic navigation tracking
await trackNavigation('/home', '/products');

// With explicit path
await trackNavigation('/users/123', '/users/456', '/users');
```

#### `trackClick(element, path?, metadata?)`

Track click events on HTML elements with automatic element data extraction.

**Parameters:**
- `element: HTMLElement` - The clicked element
- `path?: string` - Current page path (defaults to `window.location.pathname`)
- `metadata?: Record<string, unknown>` - Additional click data

**Example:**
```typescript
// Track button click
const button = document.getElementById('submit-btn');
await trackClick(button);

// With additional metadata
const link = document.querySelector('a[data-product-id="123"]');
await trackClick(link, '/products', {
  productId: '123',
  category: 'electronics',
  price: 299.99
});

// Event listener example
document.addEventListener('click', async (event) => {
  if (event.target instanceof HTMLElement) {
    await trackClick(event.target);
  }
});
```

#### `trackInput(element, value?, path?)`

Track input changes in forms with debouncing and value length tracking.

**Parameters:**
- `element: HTMLElement` - The input element
- `value?: string` - Input value (stored securely with length tracking)
- `path?: string` - Current page path

**Example:**
```typescript
// Track input change
const emailInput = document.getElementById('email');
await trackInput(emailInput, emailInput.value);

// Event listener with debouncing
let timeoutId;
document.addEventListener('input', (event) => {
  if (event.target instanceof HTMLInputElement) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      await trackInput(event.target, event.target.value);
    }, 1000); // 1 second debounce
  }
});
```

#### `trackCustom(eventName, metadata?, path?)`

Convenient wrapper for tracking custom business events.

**Parameters:**
- `eventName: string` - Name of the custom event
- `metadata?: Record<string, unknown>` - Event-specific data
- `path?: string` - Current page path

**Example:**
```typescript
// Track business events
await trackCustom('purchase_completed', {
  orderId: '12345',
  amount: 99.99,
  currency: 'USD',
  items: ['product-1', 'product-2']
});

await trackCustom('search_performed', {
  query: 'javascript tutorials',
  results: 42,
  filters: ['beginner', 'video']
});

await trackCustom('error_occurred', {
  errorType: 'validation',
  field: 'email',
  message: 'Invalid email format'
});
```

### Connection Management

#### `getConnectionStatus()`

Check if the MCP worker is connected to the proxy server.

**Returns:** `Promise<boolean>`

**Example:**
```typescript
const isConnected = await getConnectionStatus();
if (!isConnected) {
  console.warn('MCP connection lost, events may not be available to AI agents');
}
```

#### `onConnectionStatus(callback)` / `offConnectionStatus(callback)`

Subscribe to connection status changes.

**Parameters:**
- `callback: (connected: boolean) => void` - Status change callback

**Example:**
```typescript
const handleConnectionChange = (connected) => {
  console.log('MCP connection:', connected ? 'Connected' : 'Disconnected');
  
  // Update UI indicator
  const indicator = document.getElementById('connection-status');
  indicator.className = connected ? 'connected' : 'disconnected';
  indicator.textContent = connected ? '🟢 Connected' : '🔴 Offline';
};

// Start listening
onConnectionStatus(handleConnectionChange);

// Stop listening (e.g., on component unmount)
offConnectionStatus(handleConnectionChange);
```

### Authentication

#### `setAuthToken(token)`

Set authentication token for associating events with specific users.

**Parameters:**
- `token: string` - Authentication token (e.g., JWT)

**Example:**
```typescript
// After user login
async function handleLogin(credentials) {
  const response = await authenticateUser(credentials);
  
  // Set token for MCP tracking
  setAuthToken(response.accessToken);
  
  // Track login event
  await trackCustom('user_logged_in', {
    userId: response.user.id,
    method: 'password'
  });
}

// On logout
async function handleLogout() {
  await trackCustom('user_logged_out');
  
  // Clear authentication
  setAuthToken('');
}
```


## Integration with AI Agents

Once events are tracked and stored, AI agents can query them through the MCP protocol:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call", 
  "params": {
    "name": "get_user_events",
    "arguments": {
      "type": "click",
      "limit": 10,
      "startTime": 1705712400000
    }
  }
}
```

This enables AI agents to:
- Provide context-aware customer support
- Debug user interface issues
- Analyze user behavior patterns
- Guide users through complex workflows
- Understand error scenarios and user frustration points

## Best Practices

### Event Granularity

```typescript
// ✅ Good: Track meaningful interactions
await trackClick(submitButton, '/checkout', {
  step: 'payment',
  amount: totalAmount
});

// ❌ Too granular: Don't track every mouseover
document.addEventListener('mouseover', trackEvent); // Avoid this
```

### Sensitive Data

```typescript
// ✅ Good: Track input activity without sensitive values
await trackInput(passwordInput, undefined, '/login'); // Don't pass actual password

// ✅ Good: Track metadata about sensitive operations
await trackCustom('payment_submitted', {
  amount: 99.99,
  currency: 'USD',
  // Don't include card numbers or CVV
});
```

### Performance

```typescript
// ✅ Good: Debounce high-frequency events
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    await trackInput(searchInput, searchInput.value);
  }, 500);
});

// ✅ Good: Batch related events
await Promise.all([
  trackCustom('form_submitted'),
  trackNavigation('/form', '/success')
]);
```

## Error Handling

```typescript
// Wrap tracking calls in try-catch for production resilience
async function safeTrackEvent(eventData) {
  try {
    await trackEvent(eventData);
  } catch (error) {
    // Log error but don't break user experience
    console.warn('Failed to track event:', error);
  }
}

// Check connection before critical tracking
const isConnected = await getConnectionStatus();
if (isConnected) {
  await trackCustom('critical_business_event', eventData);
} else {
  // Store locally or queue for later
  localStorage.setItem('pending_events', JSON.stringify([eventData]));
}
```

## Troubleshooting

### Events Not Being Stored

1. **Check worker initialization**: Ensure `initEventTracker()` completed successfully
2. **Verify worker files**: Make sure MCP worker files are in your public directory
3. **Check connection**: Use `getConnectionStatus()` to verify proxy connection

### Connection Issues

1. **Proxy server**: Verify the MCP proxy server is running at the specified WebSocket URL
2. **CORS**: Check browser console for CORS errors
3. **WebSocket**: Verify WebSocket connection in browser Developer Tools

### Memory Usage

1. **Event cleanup**: Periodically clean old events from IndexedDB
2. **Debouncing**: Use appropriate debouncing for high-frequency events
3. **Selective tracking**: Only track events that provide value to AI agents

## Requirements

- **Modern Browser**: ES2020+ support
- **MCP Worker Setup**: Requires [`@mcp-fe/mcp-worker`](../mcp-worker/README.md) configuration
- **MCP Proxy Server**: A running MCP proxy server to collect events

## Related Packages

- **[@mcp-fe/mcp-worker](../mcp-worker/README.md)**: Core MCP worker implementation
- **[@mcp-fe/react-event-tracker](../react-event-tracker/README.md)**: React-specific integration
- **[Main MCP-FE Project](../../README.md)**: Complete ecosystem documentation

## Credits

Created and maintained with ❤️ by [Michal Kopecký](https://github.com/kopecmi8).

## License

Licensed under the Apache License, Version 2.0. See the [LICENSE](../../LICENSE) file for details.
