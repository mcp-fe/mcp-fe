# API Reference

Complete API documentation for `@mcp-fe/mcp-worker`.

## WorkerClient

The main singleton instance for communicating with the MCP worker.

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';
```

### Initialization

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

**Returns:** `Promise<void>`

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

### Event Storage

#### `workerClient.post(type, payload?)`

Send a fire-and-forget message to the worker.

**Parameters:**
- `type: string` - Message type
- `payload?: Record<string, unknown>` - Message payload

**Returns:** `Promise<void>`

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

### Authentication

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

### Connection Status

#### `workerClient.getConnectionStatus()`

Get current connection status to the MCP proxy server.

**Returns:** `Promise<boolean>` - Connection status

**Example:**
```typescript
const isConnected = await workerClient.getConnectionStatus();
console.log('MCP connection:', isConnected ? 'Connected' : 'Disconnected');
```

#### `workerClient.onConnectionStatus(callback)`

Subscribe to connection status changes.

**Parameters:**
- `callback: (connected: boolean) => void` - Status change callback

**Example:**
```typescript
const handleConnectionChange = (connected: boolean) => {
  console.log('Connection status:', connected ? 'Connected' : 'Disconnected');
};

workerClient.onConnectionStatus(handleConnectionChange);
```

#### `workerClient.offConnectionStatus(callback)`

Unsubscribe from connection status changes.

**Parameters:**
- `callback: (connected: boolean) => void` - Previously registered callback

**Example:**
```typescript
workerClient.offConnectionStatus(handleConnectionChange);
```

### Dynamic Tool Registration

#### `workerClient.registerTool(name, description, inputSchema, handler)`

Register a custom MCP tool dynamically.

**Parameters:**
- `name: string` - Tool name (use snake_case)
- `description: string` - Tool description (AI uses this)
- `inputSchema: Record<string, unknown>` - JSON Schema for input validation
- `handler: (args: unknown) => Promise<ToolResult>` - Async handler function

**Returns:** `Promise<void>`

**Example:**
```typescript
await workerClient.registerTool(
  'get_user_data',
  'Get current user information',
  { type: 'object', properties: {} },
  async () => {
    const user = getCurrentUser();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(user)
      }]
    };
  }
);
```

See [Dynamic Tool Registration Guide](./guide.md) for complete documentation.

#### `workerClient.unregisterTool(name)`

Unregister a previously registered tool.

**Parameters:**
- `name: string` - Tool name to unregister

**Returns:** `Promise<boolean>` - True if tool was found and removed

**Example:**
```typescript
const success = await workerClient.unregisterTool('get_user_data');
```

#### `workerClient.onToolChange(name, callback)`

Subscribe to tool registration changes (for reactive updates).

**Parameters:**
- `name: string` - Tool name to watch
- `callback: (info: ToolInfo | null) => void` - Change callback

**Returns:** `() => void` - Unsubscribe function

**Example:**
```typescript
const unsubscribe = workerClient.onToolChange('my_tool', (info) => {
  console.log('Tool info:', info);
});

// Later: unsubscribe
unsubscribe();
```

#### `workerClient.getToolInfo(name)`

Get information about a registered tool.

**Parameters:**
- `name: string` - Tool name

**Returns:** `ToolInfo | null`

```typescript
interface ToolInfo {
  refCount: number;
  isRegistered: boolean;
}
```

**Example:**
```typescript
const info = workerClient.getToolInfo('my_tool');
if (info) {
  console.log('RefCount:', info.refCount);
  console.log('Registered:', info.isRegistered);
}
```

#### `workerClient.isToolRegistered(name)`

Check if a tool is registered.

**Parameters:**
- `name: string` - Tool name

**Returns:** `boolean`

**Example:**
```typescript
if (workerClient.isToolRegistered('my_tool')) {
  console.log('Tool is registered');
}
```

#### `workerClient.getRegisteredTools()`

Get all registered tool names.

**Returns:** `string[]`

**Example:**
```typescript
const tools = workerClient.getRegisteredTools();
console.log('Registered tools:', tools);
```

### Worker State

#### `workerClient.initialized`

Check if the worker is initialized.

**Type:** `boolean` (getter)

**Example:**
```typescript
if (workerClient.initialized) {
  console.log('Worker is ready');
}
```

#### `workerClient.waitForInit()`

Wait for worker initialization to complete.

**Returns:** `Promise<void>`

**Example:**
```typescript
await workerClient.waitForInit();
console.log('Worker is now initialized');
```

## Type Definitions

### ToolResult

```typescript
interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}
```

### ToolHandler

```typescript
type ToolHandler = (args: unknown) => Promise<ToolResult>;
```

### UserEvent

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
    console.log('SharedWorker not supported, using ServiceWorker fallback');
  } else {
    console.error('Worker initialization failed:', error);
  }
}

// Handle request timeouts
try {
  const data = await workerClient.request('GET_EVENTS', {}, 2000); // 2s timeout
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Request timed out');
  }
}
```

## MCP Tools Exposed

The worker exposes these MCP tools to AI agents:

- `get_user_events` - Query stored user interaction events
- `get_connection_status` - Check WebSocket connection status
- `get_session_info` - Get current session information
- Custom tools registered via `registerTool()`

## See Also

- [Guide](./guide.md) - Dynamic tool registration guide
- [Worker Implementation Details](./worker-details.md) - Technical details
- [Architecture](./architecture.md) - How it works
