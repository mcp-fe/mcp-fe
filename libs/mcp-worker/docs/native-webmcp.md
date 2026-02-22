# Native WebMCP Integration

## Overview

The MCP Worker library includes an opt-in adapter for the **Native WebMCP API** (`navigator.modelContext`), a browser-native mechanism for registering MCP tools directly with the user-agent. When the browser supports this API, tools registered via `WorkerClient` can be automatically advertised through the native channel as well, enabling browser-level tool discovery by AI agents, browser's agents, and assistive technologies.

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
│       └──→ NativeMcpAdapter (if enabled + supported)      │
│                └──→ navigator.modelContext.registerTool()  │
│                     (browser-native registration)         │
└──────────────────────────────────────────────────────────┘
```

**Key principle**: The worker transport remains the **primary** channel. Native WebMCP registration is a **secondary, additive** channel for browser-level discovery. Both systems coexist.

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

// §5.2.2 ToolAnnotations
dictionary ToolAnnotations {
  boolean readOnlyHint;
};

// §5.2.2 ToolExecuteCallback
callback ToolExecuteCallback = Promise<any> (object input, ModelContextClient client);

// §5.2.3 ModelContextClient
interface ModelContextClient {
  Promise<any> requestUserInteraction(UserInteractionCallback callback);
};
```

## Feature Detection

```typescript
import { WorkerClient, NativeMcpAdapter } from '@anthropic/mcp-worker';

// Static check: does the browser support navigator.modelContext?
if (WorkerClient.isNativeMcpSupported()) {
  console.log('Browser supports native WebMCP!');
}

// Or use the adapter directly:
if (NativeMcpAdapter.isSupported()) {
  console.log('navigator.modelContext is available');
}
```

## Enabling Native WebMCP

### Option 1: At initialization

```typescript
import { workerClient } from '@anthropic/mcp-worker';

await workerClient.init({
  sharedWorkerUrl: '/mcp-shared-worker.js',
  backendWsUrl: 'ws://localhost:3001',
  enableNativeMcp: true,  // ← opt-in
});
```

### Option 2: At runtime (toggle)

```typescript
// Enable — syncs all existing tools to navigator.modelContext immediately
workerClient.setNativeMcpEnabled(true);

// Disable — calls navigator.modelContext.clearContext()
workerClient.setNativeMcpEnabled(false);
```

## Registering Tools

No changes to tool registration are needed. When native WebMCP is enabled and supported, `registerTool()` automatically registers in both systems:

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
workerClient.isToolRegistered('get-user-profile');         // true (local + worker)
workerClient.isToolRegisteredNatively('get-user-profile'); // true (navigator.modelContext)
```

Under the hood, the adapter builds a `ModelContextTool` dictionary and calls `navigator.modelContext.registerTool(tool)` synchronously. The internal handler is wrapped as the `execute` callback that the browser invokes when an agent calls the tool.

## Querying Native Registrations

```typescript
// Check if a specific tool is registered natively
workerClient.isToolRegisteredNatively('my-tool'); // boolean

// Get all natively registered tool names
workerClient.getNativelyRegisteredTools(); // string[]

// Check if native MCP is currently enabled AND supported
workerClient.isNativeMcpAvailable(); // boolean
```

## Cleanup

Native registrations are cleaned up automatically:

- **On `unregisterTool()`** — calls `navigator.modelContext.unregisterTool(name)`
- **On page unload** (`beforeunload` / `pagehide`) — calls `navigator.modelContext.clearContext()`
- **On `setNativeMcpEnabled(false)`** — calls `navigator.modelContext.clearContext()`

## Architecture

### Files

| File | Purpose |
|------|---------|
| `native-mcp-types.ts` | TypeScript types matching the WebMCP spec (`ModelContext`, `ModelContextTool`, `ModelContextClient`, etc.) |
| `native-mcp-adapter.ts` | Adapter that bridges ToolRegistry ↔ `navigator.modelContext` |
| `worker-client.ts` | Integration point (uses adapter internally) |

### Type Augmentation

The `native-mcp-types.ts` file extends the global `Navigator` interface:

```typescript
declare global {
  interface Navigator {
    readonly modelContext?: ModelContext;
  }
}
```

This enables type-safe access to `navigator.modelContext` throughout the project.

### NativeMcpAdapter

The adapter is a standalone class with no side effects until `setEnabled(true)` is called:

- **`isSupported()`** — static, checks `navigator.modelContext` existence
- **`isAvailable()`** — instance, respects enabled flag + browser support
- **`registerTool()`** — builds `ModelContextTool` dict and calls `navigator.modelContext.registerTool(tool)` (synchronous)
- **`unregisterTool()`** — calls `navigator.modelContext.unregisterTool(name)` (synchronous)
- **`clearAll()`** — calls `navigator.modelContext.clearContext()` (per spec §5.2, clears all tools at once)
- **`toModelContextTool()`** — static utility to convert internal `ToolDefinition` + handler to `ModelContextTool`

### Handler Mapping

The spec defines `ToolExecuteCallback` as:

```typescript
callback ToolExecuteCallback = Promise<any> (object input, ModelContextClient client);
```

The adapter wraps the internal `ToolHandler` (which takes `args: unknown` and returns `{ content: [...] }`) into this format. The `ModelContextClient` parameter gives the tool handler access to `requestUserInteraction()` for user consent flows — this can be exposed to tool authors in the future.

## Error Handling

All native WebMCP operations are **best-effort**:

- Registration failures are logged as warnings, never thrown
- The worker-based system is unaffected by native API errors
- Per spec, `registerTool()` throws if a duplicate name exists — the adapter unregisters first
- `clearAll()` falls back to individual `unregisterTool()` calls if `clearContext()` throws

## Browser Support

The WebMCP specification is a CG-DRAFT published by the W3C Web Machine Learning Community Group (February 2026). The adapter is designed to be forward-compatible:

- When the API is unavailable, all native operations are silent no-ops
- Zero runtime cost when disabled (no feature detection on hot paths)
- The type definitions follow the spec and can be updated as the standard evolves
