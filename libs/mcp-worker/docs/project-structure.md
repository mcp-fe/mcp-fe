# Project Structure

This document explains the organization of the `@mcp-fe/mcp-worker` codebase.

## Directory Layout

```
libs/mcp-worker/src/
├── index.ts                    # Main entry point (re-exports from client/)
├── mcp-shared-worker.ts        # SharedWorker entry point
├── mcp-service-worker.ts       # ServiceWorker entry point
├── client/                     # Client-side code (application runtime)
│   ├── index.ts                # Client API exports
│   └── worker-client.ts        # Main WorkerClient class
├── worker/                     # Worker-side code (background processing)
│   ├── index.ts                # Worker internal exports
│   ├── mcp-controller.ts       # MCP server controller & lifecycle
│   ├── mcp-server.ts           # MCP server setup & handlers
│   ├── websocket-transport.ts  # WebSocket transport for MCP
│   ├── tool-registry.ts        # Dynamic tool registration
│   ├── tab-manager.ts          # Multi-tab coordination
│   ├── built-in-tools.ts       # Default MCP tools
│   └── tab-manager.spec.ts     # Tests for TabManager
└── shared/                     # Shared code (both contexts)
    ├── types.ts                # TypeScript type definitions
    ├── logger.ts               # Logging utilities
    └── database.ts             # IndexedDB operations
```

## Module Responsibilities

### Client (`client/`)

**Purpose:** Code that runs in the main browser thread (your application).

**Key Files:**
- `worker-client.ts` - Main API for communicating with workers
  - Handles worker initialization (SharedWorker vs ServiceWorker)
  - Manages tool registration and lifecycle
  - Handles multi-tab coordination
  - Provides request/response messaging

**Used by:** Your application code

**Example:**
```typescript
import { workerClient } from '@mcp-fe/mcp-worker';
await workerClient.init();
```

### Worker (`worker/`)

**Purpose:** Code that runs inside Web Workers (background processing).

**Key Files:**
- `mcp-controller.ts` - Main controller for MCP server lifecycle
  - WebSocket connection management
  - Tool call routing and execution
  - Tab management coordination
  - Event storage and querying

- `mcp-server.ts` - MCP server setup using @modelcontextprotocol/sdk
  - Request handlers (ListTools, CallTool)
  - Server configuration and capabilities

- `tool-registry.ts` - Dynamic tool management
  - Tool definition storage
  - Handler registration and lookup
  - Tool lifecycle management

- `tab-manager.ts` - Multi-tab coordination
  - Tab registration and tracking
  - Active tab management
  - Smart tool routing across tabs

- `built-in-tools.ts` - Default MCP tools
  - Event querying tools
  - Tab listing tools
  - Navigation history tools

**Used by:** Worker entry points (`mcp-shared-worker.ts`, `mcp-service-worker.ts`)

### Shared (`shared/`)

**Purpose:** Code used by both client and worker contexts.

**Key Files:**
- `types.ts` - TypeScript type definitions
  - `UserEvent`, `ToolDefinition`, `ToolHandler`
  - `TabInfo`, `EventFilters`, etc.
  - Ensures type consistency across contexts

- `logger.ts` - Logging utilities
  - Environment-aware logging (dev vs production)
  - Consistent logging interface
  - Works in both main thread and workers

- `database.ts` - IndexedDB operations
  - Event storage and retrieval
  - Query filtering and pagination
  - Available in both contexts (IndexedDB works everywhere)

**Used by:** Both client and worker code

## Communication Flow

```
Application Code
    ↓ (imports)
client/worker-client.ts
    ↓ (postMessage)
mcp-shared-worker.ts or mcp-service-worker.ts
    ↓ (uses)
worker/mcp-controller.ts
    ↓ (uses)
worker/mcp-server.ts
    ↓ (uses)
worker/tool-registry.ts
    ↓ (WebSocket)
MCP Proxy Server
```

## Import Patterns

### For Application Code

```typescript
// Import from the main package
import { workerClient, type ToolDefinition } from '@mcp-fe/mcp-worker';
```

### Internal Worker Code

```typescript
// Worker modules import from shared/
import { logger } from '../shared/logger';
import type { UserEvent } from '../shared/types';

// Worker modules import from other worker modules
import { toolRegistry } from './tool-registry';
import { TabManager } from './tab-manager';
```

### Internal Client Code

```typescript
// Client modules import from shared/
import { logger } from '../shared/logger';
import type { ToolDefinition } from '../shared/types';
```

## Why This Structure?

### Clear Separation of Concerns
- **Client code** only deals with communication and API
- **Worker code** handles MCP protocol and business logic
- **Shared code** provides common utilities and types

### Better Tree-Shaking
- Applications only import client code
- Worker bundles only include worker code
- No unnecessary code in either bundle

### Maintainability
- Easy to find where specific functionality lives
- Clear boundaries between contexts
- Prevents accidental mixing of client/worker code

### Future-Proof
- Ready for splitting into separate npm packages if needed
- Can add more worker types (e.g., dedicated workers)
- Easy to add more shared utilities
