# WebMCP Integration

## Overview

The MCP Worker library includes a built-in adapter for the **WebMCP API** (`navigator.modelContext`), a browser-native mechanism for registering MCP tools directly with the user-agent. When the browser supports this API, tools registered via `WorkerClient` are **automatically** advertised through the native channel as well, enabling browser-level tool discovery by AI agents, browser's agents, and assistive technologies.

**Enabled by default** — if the browser supports `navigator.modelContext`, it just works. No configuration needed. You can explicitly disable it if needed.

Based on the [WebMCP specification](https://webmachinelearning.github.io/webmcp/) published by the W3C Web Machine Learning Community Group.

## How It Works

```
┌──────────────────────────────────────────────────────────┐
│                    WorkerClient                           │
│                                                           │
│  registerTool('my-tool', ...)                             │
│       │                                                   │
│       ├──→ ToolRegistry (local, immediate)                │
│       │                                                   │
│       ├──→ SharedWorker / ServiceWorker (transport)       │
│       │        └──→ WebSocket → Backend MCP Server        │
│       │                                                   │
│       └──→ WebMcpAdapter (auto-enabled if supported)      │
│                └──→ navigator.modelContext.registerTool()  │
│                     (browser-native registration)         │
└──────────────────────────────────────────────────────────┘
```

**Key principle**: The worker transport remains the **primary** channel. WebMCP registration is a **secondary, additive** channel for browser-level discovery. Both systems coexist.

## WebMCP Spec API Surface

The adapter maps to the following browser API (per spec §5):

```webidl
// §5.1 Navigator extension
partial interface Navigator {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};

// §5.2 ModelContext interface
interface ModelContext {
  undefined provideContext(optional ModelContextOptions options = {});
  undefined clearContext();
  undefined registerTool(ModelContextTool tool);
  undefined unregisterTool(DOMString name);
};

// §5.2.2 ModelContextTool dictionary
dictionary ModelContextTool {
  required DOMString name;
  required DOMString description;
  object inputSchema;
  required ToolExecuteCallback execute;
  ToolAnnotations annotations;
};

dictionary ToolAnnotations {
  boolean readOnlyHint;
};

callback ToolExecuteCallback = Promise<any> (object input, ModelContextClient client);

// §5.2.3 ModelContextClient
interface ModelContextClient {
  Promise<any> requestUserInteraction(UserInteractionCallback callback);
};
```

## Feature Detection

```typescript
import { WorkerClient, WebMcpAdapter } from '@anthropic/mcp-worker';

// Static check: does the browser support navigator.modelContext?
if (WorkerClient.isWebMcpSupported()) {
  console.log('Browser supports WebMCP!');
}

// Or use the adapter directly:
if (WebMcpAdapter.isSupported()) {
  console.log('navigator.modelContext is available');
}
```

## Configuration

### Default behavior (auto-enabled)

No configuration needed. If `navigator.modelContext` is available, tools are automatically registered via WebMCP:

```typescript
import { workerClient } from '@anthropic/mcp-worker';

await workerClient.init({
  sharedWorkerUrl: '/mcp-shared-worker.js',
  backendWsUrl: 'ws://localhost:3001',
  // enableWebMcp defaults to true — auto-detects browser support
});
```

### Explicitly disable

```typescript
await workerClient.init({
  sharedWorkerUrl: '/mcp-shared-worker.js',
  backendWsUrl: 'ws://localhost:3001',
  enableWebMcp: false,  // ← disable WebMCP registration
});
```

### Toggle at runtime

```typescript
// Disable — calls navigator.modelContext.clearContext()
workerClient.setWebMcpEnabled(false);

// Re-enable — syncs all existing tools to navigator.modelContext
workerClient.setWebMcpEnabled(true);
```

## Registering Tools

No changes to tool registration are needed. When WebMCP is available, `registerTool()` automatically registers in both systems:

```typescript
await workerClient.registerTool(
  'get-user-profile',
  'Fetch the current user profile',
  {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User ID' },
    },
    required: ['userId'],
  },
  async (args: unknown) => {
    const { userId } = args as { userId: string };
    const profile = await fetchProfile(userId);
    return {
      content: [{ type: 'text', text: JSON.stringify(profile) }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

// Check where the tool is registered:
workerClient.isToolRegistered('get-user-profile');            // true (local + worker)
workerClient.isToolRegisteredViaWebMcp('get-user-profile');   // true (navigator.modelContext)
```

## Querying WebMCP Registrations

```typescript
// Check if a specific tool is registered via WebMCP
workerClient.isToolRegisteredViaWebMcp('my-tool'); // boolean

// Get all WebMCP-registered tool names
workerClient.getWebMcpRegisteredTools(); // string[]

// Check if WebMCP is currently enabled AND supported
workerClient.isWebMcpAvailable(); // boolean
```

## Cleanup

WebMCP registrations are cleaned up automatically:

- **On `unregisterTool()`** — calls `navigator.modelContext.unregisterTool(name)`
- **On page unload** (`beforeunload` / `pagehide`) — calls `navigator.modelContext.clearContext()`
- **On `setWebMcpEnabled(false)`** — calls `navigator.modelContext.clearContext()`

## Architecture

### Files

| File | Purpose |
|------|---------|
| `web-mcp-types.ts` | TypeScript types matching the WebMCP spec (`ModelContext`, `ModelContextTool`, `ModelContextClient`, etc.) |
| `web-mcp-adapter.ts` | Adapter that bridges ToolRegistry ↔ `navigator.modelContext` |
| `worker-client.ts` | Integration point (uses adapter internally) |

### Type Augmentation

The `web-mcp-types.ts` file extends the global `Navigator` interface:

```typescript
declare global {
  interface Navigator {
    readonly modelContext?: ModelContext;
  }
}
```

### WebMcpAdapter

The adapter is a standalone class, enabled by default:

- **`isSupported()`** — static, checks `navigator.modelContext` existence
- **`isAvailable()`** — instance, respects enabled flag + browser support
- **`registerTool()`** — builds `ModelContextTool` dict and calls `navigator.modelContext.registerTool(tool)` (synchronous)
- **`unregisterTool()`** — calls `navigator.modelContext.unregisterTool(name)` (synchronous)
- **`clearAll()`** — calls `navigator.modelContext.clearContext()` (per spec §5.2)
- **`toModelContextTool()`** — static utility to convert internal `ToolDefinition` + handler

### Handler Mapping

The spec defines `ToolExecuteCallback` as:

```typescript
callback ToolExecuteCallback = Promise<any> (object input, ModelContextClient client);
```

The adapter wraps the internal `ToolHandler` (which takes `args: unknown` and returns `{ content: [...] }`) into this format. The `ModelContextClient` parameter gives access to `requestUserInteraction()` for user consent flows.

## Error Handling

All WebMCP operations are **best-effort**:

- Registration failures are logged as warnings, never thrown
- The worker-based system is unaffected by WebMCP errors
- Per spec, `registerTool()` throws if a duplicate name exists — the adapter unregisters first
- `clearAll()` falls back to individual `unregisterTool()` calls if `clearContext()` throws

## Browser Support

The WebMCP specification is a CG-DRAFT published by the W3C Web Machine Learning Community Group (February 2026). The adapter is forward-compatible:

- When the API is unavailable, all WebMCP operations are silent no-ops
- Zero runtime cost when browser doesn't support it (no feature detection on hot paths)
- The type definitions follow the spec and can be updated as the standard evolves
