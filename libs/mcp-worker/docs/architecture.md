# Proxy Architecture

How dynamic tool registration works with handlers running in the main thread.

## Overview

The library uses a **proxy pattern** where:
- ✅ Handlers run in **main thread** (browser context)
- ✅ Worker acts as **proxy** between MCP and handlers
- ✅ **No serialization** of function code
- ✅ **Full access** to browser APIs, React, imports, etc.

## Architecture

```
┌─────────────────────┐
│   MCP Client        │
│   (Claude, etc.)    │
└──────────┬──────────┘
           │ MCP Protocol
           ▼
┌─────────────────────┐
│  Shared/Service     │
│  Worker (MCP Server)│
│                     │
│  Tool Registry      │
│  ├─ Proxy Handler   │ ← metadata + proxy
│  └─ postMessage     │
└──────────┬──────────┘
           │ postMessage({ type: 'CALL_TOOL', args, callId })
           ▼
┌─────────────────────┐
│  Main Thread        │
│  (Browser Context)  │
│                     │
│  WorkerClient       │
│  ├─ toolHandlers    │ ← actual handler functions
│  └─ execute         │ ← with full API access
└──────────┬──────────┘
           │ postMessage({ type: 'TOOL_CALL_RESULT', result })
           ▼
┌─────────────────────┐
│  Worker             │
│  ├─ resolve Promise │
│  └─ return to MCP   │
└─────────────────────┘
```

## Benefits

### No Serialization Issues
- Handlers are normal functions in main thread
- No `.toString()` → `new Function()` conversion
- All closures and imports preserved

### Full Browser API Access
```typescript
await client.registerTool('get_page_info', '...', {}, async () => {
  // ✅ DOM access
  const title = document.title;
  
  // ✅ localStorage
  const theme = localStorage.getItem('theme');
  
  // ✅ React hooks/context (if handler in component)
  const user = useUser();
  
  return { content: [{ type: 'text', text: JSON.stringify({ title, theme, user }) }] };
});
```

### Use Any Imports
```typescript
import { z } from 'zod';
import { myApi } from './api';

await client.registerTool('validate', '...', schema, async (args: any) => {
  // ✅ Use any imports!
  const validated = z.object({ ... }).parse(args);
  const result = await myApi.callSomething(validated);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
```

### Easy Testing
```typescript
// Handler is a normal async function
const myHandler = async (args: any) => {
  // ... logic ...
  return { content: [{ type: 'text', text: '...' }] };
};

// Test directly
test('myHandler works', async () => {
  const result = await myHandler({ test: 'data' });
  expect(result.content[0].text).toContain('data');
});

// Then register
await client.registerTool('my_tool', '...', schema, myHandler);
```

## Implementation

### WorkerClient (Main Thread)

Stores handlers locally and executes them when called:

```typescript
private toolHandlers = new Map<string, HandlerFunction>();

public async registerTool(name, description, schema, handler) {
  // Store handler in main thread
  this.toolHandlers.set(name, handler);
  
  // Tell worker to create proxy
  await this.request('REGISTER_TOOL', {
    name, description, inputSchema: schema,
    handlerType: 'proxy'  // ← important!
  });
}

private async handleToolCall(toolName: string, args: unknown, callId: string) {
  try {
    const handler = this.toolHandlers.get(toolName);
    const result = await handler(args); // ← runs in main thread!
    
    this.sendToolCallResult(callId, { success: true, result });
  } catch (error) {
    this.sendToolCallResult(callId, { success: false, error: error.message });
  }
}
```

### MCPController (Worker)

Creates proxy handler and forwards calls:

```typescript
public async handleRegisterTool(toolData: Record<string, unknown>) {
  const { name, description, inputSchema, handlerType } = toolData;
  
  if (handlerType === 'proxy') {
    // Create proxy handler that forwards to main thread
    mcpServer.registerTool(name, description, inputSchema, 
      async (args: unknown) => {
        // Forward to main thread
        const callId = generateId();
        this.broadcast({ type: 'CALL_TOOL', toolName: name, args, callId });
        
        // Wait for result
        return await this.waitForToolCallResult(callId);
      }
    );
  }
}
```

## Message Flow

1. **MCP Client** calls tool via MCP protocol
2. **Worker** receives MCP tool call
3. **Worker** sends `CALL_TOOL` message to main thread (with targetTabId if specified)
4. **Main Thread** (specific tab) executes handler function
5. **Main Thread** sends `TOOL_CALL_RESULT` back
6. **Worker** resolves promise and returns to MCP
7. **MCP Client** receives result

## Multi-Tab Support

### Architecture

The library supports multiple browser tabs running the same application, with intelligent routing of tool calls:

```
┌─────────────────────┐
│   MCP Client        │
│   (Claude, etc.)    │
└──────────┬──────────┘
           │ MCP Protocol (with optional tabId param)
           ▼
┌─────────────────────┐
│  Shared Worker      │
│                     │
│  Tab Registry       │
│  ├─ Tab 1 (active)  │
│  ├─ Tab 2           │
│  └─ Tab 3           │
│                     │
│  Tool Registry      │
│  └─ get_page_info   │
│     ├─ Tab 1 ✓      │ ← Hybrid routing logic
│     └─ Tab 2 ✓      │
└──────────┬──────────┘
           │ Route to specific tab or active tab
           ▼
┌─────────────────────┐
│  Main Threads       │
│  ├─ Tab 1 (active)  │ ← Focused/visible tab
│  └─ Tab 2           │
└─────────────────────┘
```

### Tab Management

**Automatic Tab Registration:**
- Each tab gets unique ID via `crypto.randomUUID()`
- Stored in `sessionStorage` (persists across refreshes)
- Registered with worker on init

**Focus Tracking:**
- Active tab tracked via `window.focus` and `document.visibilitychange`
- Worker maintains `activeTabId` for default routing

### Hybrid Routing Strategy

When a tool is called, the worker uses this logic:

1. **Explicit `tabId` parameter**: Route to specified tab
2. **No `tabId` + active tab exists**: Route to focused tab (user-friendly default)
3. **No `tabId` + no active tab**: Route to first available tab (fallback)
4. **Invalid `tabId`**: Return error with list of available tabs

**Example:**
```typescript
// Agent discovers tabs
list_browser_tabs()
// → [{ tabId: "abc-123", title: "Dashboard", isActive: true }, ...]

// Agent calls tool without tabId (uses active tab)
get_page_info()
// → Routes to focused tab automatically

// Agent calls tool with specific tabId
get_page_info({ tabId: "abc-123" })
// → Routes to Dashboard tab precisely
```

### Tool Schema Enhancement

All tools automatically get optional `tabId` parameter:

```json
{
  "type": "object",
  "properties": {
    // ... your properties ...
    "tabId": {
      "type": "string",
      "description": "Optional: Target specific tab by ID. If not provided, uses the currently focused tab."
    }
  }
}
```

### Built-in Meta Tools

**`list_browser_tabs`**: Discover available tabs
- Returns tab IDs, URLs, titles, active status
- Use before calling tools with specific tabIds

## Why This Works

- **Worker**: Runs 24/7, maintains MCP connection
- **Main Thread**: Has full browser API access
- **Messages**: Bridge between the two contexts
- **Handlers**: Execute where they have access to everything

## Trade-offs

### Advantages
- ✅ Full browser API access
- ✅ No serialization issues
- ✅ Easy to implement
- ✅ Easy to test
- ✅ Works with any library

### Considerations
- Message passing overhead (minimal, ~1-2ms)
- Handler must be async (already required by MCP)

## Usage

See [Guide](./guide.md) for complete usage guide and examples.

See [examples/](../examples/) for runnable code examples.

```
