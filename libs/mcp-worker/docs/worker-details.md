# Worker Implementation Details

Technical details about how the MCP Worker implementation works under the hood.

## Worker Architecture

### SharedWorker vs ServiceWorker

The library uses a **dual worker strategy** with automatic fallback:

#### SharedWorker (Preferred)

**Advantages:**
- Single instance shared across all browser windows/tabs on the same origin
- Maintains persistent WebSocket connection even when tabs are closed
- Better for multi-tab applications
- Lower resource usage (one instance for all tabs)

**Browser Support:**
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari (16.4+)
- ✅ Edge (Chromium-based)

**Requirements:**
- HTTPS in production (localhost works without HTTPS)
- Not available in private/incognito mode in some browsers
- May be blocked by enterprise policies

#### ServiceWorker (Fallback)

**Advantages:**
- Runs in background with browser-managed lifecycle
- Works in incognito mode
- Universal browser support
- Handles offline scenarios

**Considerations:**
- Separate instance per browser context
- May be terminated by browser when inactive
- Requires additional setup for multi-tab coordination

### Automatic Selection

The `WorkerClient` automatically chooses the best available option:

```typescript
await workerClient.init(); // Tries SharedWorker first, falls back to ServiceWorker
```

**Selection logic:**
1. Check if `SharedWorker` is available
2. Try to initialize SharedWorker
3. If fails, fall back to ServiceWorker
4. If both fail, throw error

You can see which worker is being used:

```typescript
// Check in browser console
console.log('[WorkerClient] Using SharedWorker'); // or
console.log('[WorkerClient] Using ServiceWorker (fallback)');
```

## Data Storage

### IndexedDB Schema

Events are stored in IndexedDB for persistence and efficient querying.

**Database:** `mcp-fe-events`  
**Object Store:** `events`

**Schema:**
```typescript
interface UserEvent {
  id: string;              // UUID
  type: 'navigation' | 'click' | 'input' | 'custom';
  timestamp: number;       // Unix timestamp in ms
  
  // Navigation events
  path?: string;
  from?: string;           // Previous route
  to?: string;             // Current route
  
  // Interaction events
  element?: string;        // Element tag name (e.g., 'button')
  elementId?: string;      // Element ID attribute
  elementClass?: string;   // Element class attribute
  elementText?: string;    // Element text content
  
  // Custom data
  metadata?: Record<string, unknown>;
}
```

**Indexes:**
- `by-type` - Query by event type
- `by-timestamp` - Query by time range
- `by-path` - Query by page path

### Storage Limits

- **Quota:** Browser-dependent (typically 10-50% of available disk space)
- **Auto-cleanup:** Old events may be removed based on storage pressure
- **Manual cleanup:** Not currently implemented (TODO)

## WebSocket Connection

### Connection Management

The worker maintains a persistent WebSocket connection to the MCP proxy server.

**Connection lifecycle:**
1. Worker initializes
2. WebSocket connects to `backendWsUrl`
3. Connection maintained with heartbeat
4. Auto-reconnect on disconnect
5. Events queued during disconnection

### Message Protocol

**From Worker to Proxy:**
```typescript
{
  type: 'mcp_request',
  id: 'unique-request-id',
  method: 'tools/call',
  params: {
    name: 'get_user_events',
    arguments: { limit: 10 }
  }
}
```

**From Proxy to Worker:**
```typescript
{
  type: 'mcp_response',
  id: 'unique-request-id',
  result: {
    content: [{
      type: 'text',
      text: '...'
    }]
  }
}
```

### Authentication

Authentication token is sent on connection:

```typescript
{
  type: 'auth',
  token: 'Bearer jwt-token-here'
}
```

Token can be updated at runtime:

```typescript
workerClient.setAuthToken('Bearer new-token');
```

## Message Passing

### WorkerClient ↔ Worker Communication

The WorkerClient uses MessageChannel for request/response pattern:

**Request flow:**
```
1. WorkerClient creates MessageChannel
2. Sends message with port2
3. Worker receives message with port2
4. Worker processes request
5. Worker sends response via port2
6. WorkerClient receives response on port1
```

**Benefits:**
- Dedicated channel per request
- No message mixing
- Built-in timeout handling
- Clean async/await pattern

### SharedWorker Communication

```typescript
// In WorkerClient
const port = sharedWorker.port;
port.start();
port.postMessage({ type: 'INIT', backendUrl: '...' });
port.onmessage = (event) => {
  // Handle messages
};
```

### ServiceWorker Communication

```typescript
// In WorkerClient
const registration = await navigator.serviceWorker.register('/sw.js');
navigator.serviceWorker.controller.postMessage({ type: 'INIT' });
navigator.serviceWorker.addEventListener('message', (event) => {
  // Handle messages
});
```

## Worker Lifecycle

### SharedWorker Lifecycle

```
Browser Start
    ↓
First Page Load
    ↓
SharedWorker Created
    ↓
Stays Active (even if all tabs closed)
    ↓
Browser Close → Worker Terminated
```

**Important:**
- Lives beyond page lifecycle
- Shared across all tabs of same origin
- Not terminated when all tabs close (in most browsers)

### ServiceWorker Lifecycle

```
Page Load
    ↓
ServiceWorker Registered
    ↓
Installing → Installed → Activating → Activated
    ↓
Handles requests
    ↓
Goes idle after period of inactivity
    ↓
Woken up when needed
```

**Important:**
- Browser controls lifecycle
- May be terminated when idle
- Automatically restarted when needed

## Performance Considerations

### Memory Usage

**SharedWorker:**
- ~2-5 MB baseline
- + event storage in IndexedDB
- + WebSocket connection overhead

**ServiceWorker:**
- Similar to SharedWorker
- Additional service worker cache (if used)

### CPU Usage

- **Idle:** Minimal (WebSocket heartbeat only)
- **Event storage:** <1ms per event
- **Event query:** 1-10ms depending on query complexity

### Network Usage

- **WebSocket:** ~1 KB/minute (heartbeat)
- **Events:** Varies by application usage
- **Reconnection:** Automatic with exponential backoff

## Browser Compatibility

### Full Feature Support

- ✅ Chrome/Chromium 80+
- ✅ Firefox 78+
- ✅ Safari 16.4+
- ✅ Edge 80+ (Chromium-based)

### Minimum Requirements

- ES2020+ support
- WebWorker API
- IndexedDB API
- WebSocket API
- MessageChannel API

### Feature Detection

The library automatically detects and uses available features:

```typescript
// SharedWorker detection
if (typeof SharedWorker !== 'undefined') {
  // Use SharedWorker
} else {
  // Fall back to ServiceWorker
}
```

## Security Considerations

### Origin Isolation

Workers are isolated by origin:
- SharedWorker: Shared only within same origin
- ServiceWorker: Scoped to registration path

### Authentication

- Token-based authentication via `setAuthToken()`
- Token transmitted over WebSocket (use WSS in production)
- Token stored in memory only (not persisted)

### Data Privacy

- Events stored in IndexedDB (per-origin storage)
- No cross-origin data access
- Events cleared when user clears browser data

### Content Security Policy (CSP)

Required CSP directives:

```http
Content-Security-Policy: 
  worker-src 'self';
  connect-src 'self' ws://localhost:3001 wss://your-proxy.com;
```

## Debugging

### Enable Debug Logs

The worker logs important events to console:

```
[WorkerClient] init() called
[WorkerClient] Using SharedWorker
[WorkerClient] Worker initialized
[MCPController] WebSocket connected
[MCPController] Registered tool: get_user_events
```

### Inspect Worker

**Chrome DevTools:**
1. Open DevTools
2. Go to Application tab
3. Select "Service Workers" or "Shared Workers"
4. Find your worker
5. Click "inspect" to open dedicated DevTools

**Firefox:**
1. Open about:debugging
2. Click "This Firefox"
3. Find your worker in "Shared Workers" or "Service Workers"
4. Click "Inspect"

### Monitor WebSocket

1. Open Network tab in DevTools
2. Filter by "WS" (WebSocket)
3. Click on the WebSocket connection
4. View Messages tab to see all messages

### Query IndexedDB

1. Open Application tab in DevTools
2. Expand "IndexedDB"
3. Find "mcp-fe-events" database
4. Browse stored events

## Troubleshooting

### SharedWorker Not Available

**Symptoms:** Falls back to ServiceWorker immediately

**Causes:**
- Browser doesn't support SharedWorker
- Private/incognito mode
- Enterprise policy blocking
- HTTP instead of HTTPS (in production)

**Solution:** Library automatically uses ServiceWorker fallback

### WebSocket Connection Fails

**Symptoms:** `getConnectionStatus()` returns `false`

**Causes:**
- Proxy server not running
- Wrong WebSocket URL
- CORS/network issues
- Firewall blocking WebSocket

**Solution:**
```typescript
// Check connection in DevTools Network tab
// Verify proxy server is running:
// curl http://localhost:3001/health
```

### Events Not Storing

**Symptoms:** `GET_EVENTS` returns empty array

**Causes:**
- Worker not initialized
- IndexedDB quota exceeded
- Browser blocking IndexedDB

**Solution:**
```typescript
// Check worker is initialized
console.log(workerClient.initialized);

// Check for quota errors in console
// Check IndexedDB in DevTools Application tab
```

## See Also

- [API Reference](./api.md) - Complete API documentation
- [Architecture](./architecture.md) - High-level architecture
- [Guide](./guide.md) - Dynamic tool registration
