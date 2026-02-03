# Architecture

Understanding the internal design and data flow of `@mcp-fe/react-tools`.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Component Tree                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Component A  │  │ Component B  │  │ Component C  │       │
│  │              │  │              │  │              │       │
│  │ useMCPTool() │  │ useMCPTool() │  │ useMCPTool() │       │
│  │   (tool_1)   │  │   (tool_1)   │  │   (tool_2)   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └──────────┬──────┘                 │               │
│                    │                        │               │
└────────────────────┼────────────────────────┼───────────────┘
                     │                        │
                     ▼                        ▼
         ┌───────────────────────────────────────────────┐
         │          Tool Registry Manager                 │
         ├───────────────────────────────────────────────┤
         │  • Reference counting                          │
         │  • Handler storage                             │
         │  • Registration/unregistration logic           │
         │                                                │
         │  toolRegistry: Map<string, ToolInfo>          │
         │    - tool_1: { refCount: 2, handler: fn }    │
         │    - tool_2: { refCount: 1, handler: fn }    │
         └───────────────────┬───────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────────────────┐
         │           WorkerClient (Singleton)             │
         ├───────────────────────────────────────────────┤
         │  • Tool registration                           │
         │  • Tool invocation                             │
         │  • Communication with worker                   │
         └───────────────────┬───────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────────────────┐
         │         MCP Worker (Service/Shared)            │
         ├───────────────────────────────────────────────┤
         │  • MCP protocol handling                       │
         │  • Communication with backend                  │
         │  • Tool execution                              │
         └───────────────────┬───────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────────────────┐
         │              MCP Backend Server                │
         │            (WebSocket Connection)              │
         └───────────────────────────────────────────────┘
```

---

## Reference Counting Flow

### Registration (Component Mount)

```
Component mounts
    ↓
useMCPTool({ name: 'my_tool', handler: fn })
    ↓
Check toolRegistry.get('my_tool')
    ↓
    ├─ Tool NOT registered (undefined)
    │      ↓
    │  1. Call workerClient.registerTool('my_tool', stableHandler)
    │  2. Set toolRegistry: { refCount: 1, handler: handlerRef }
    │  3. Return { isRegistered: true, refCount: 1 }
    │
    └─ Tool ALREADY registered
           ↓
       1. Increment refCount: refCount++
       2. Update handler: handlerRef.current = newHandler
       3. SKIP workerClient.registerTool() (already registered)
       4. Return { isRegistered: true, refCount: N }
```

### Unregistration (Component Unmount)

```
Component unmounts
    ↓
useEffect cleanup function runs
    ↓
Check toolRegistry.get('my_tool')
    ↓
Decrement refCount: refCount--
    ↓
    ├─ refCount > 0
    │      ↓
    │  Tool still in use by other components
    │  SKIP workerClient.unregisterTool()
    │
    └─ refCount === 0
           ↓
       1. Call workerClient.unregisterTool('my_tool')
       2. Delete from toolRegistry
       3. Tool fully unregistered
```

---

## Handler Update Flow

Handlers are stored in refs and automatically updated without re-registration:

```
Component renders with new handler
    ↓
useMCPTool({ handler: newHandler })
    ↓
handlerRef.current = newHandler  ← Update ref
    ↓
stableHandler remains stable (useCallback with empty deps)
    ↓
When CALL_TOOL is invoked:
    ↓
stableHandler() is called
    ↓
Executes handlerRef.current() ← Always uses latest handler!
```

**Key insight:** The stable handler acts as a proxy to the ref, ensuring the latest handler is always invoked without triggering re-registration.

---

## Component Lifecycle Integration

```typescript
function useMCPTool(options) {
  const handlerRef = useRef(options.handler);
  const registeredRef = useRef(false);
  
  // Update handler ref on every render (no re-registration)
  useEffect(() => {
    handlerRef.current = options.handler;
  });
  
  // Stable handler (never changes)
  const stableHandler = useCallback(async (args) => {
    return await handlerRef.current(args);
  }, []); // ← Empty deps = stable reference
  
  // Registration effect
  useEffect(() => {
    if (!options.autoRegister) return;
    
    // Register tool
    const toolInfo = toolRegistry.get(options.name);
    
    if (!toolInfo) {
      // First registration
      workerClient.registerTool(options.name, stableHandler);
      toolRegistry.set(options.name, { refCount: 1, handler: handlerRef });
    } else {
      // Increment ref count
      toolInfo.refCount++;
    }
    
    registeredRef.current = true;
    
    // Cleanup (unregister)
    return () => {
      if (!options.autoUnregister) return;
      
      const toolInfo = toolRegistry.get(options.name);
      if (!toolInfo) return;
      
      toolInfo.refCount--;
      
      if (toolInfo.refCount === 0) {
        workerClient.unregisterTool(options.name);
        toolRegistry.delete(options.name);
      }
      
      registeredRef.current = false;
    };
  }, [options.name, options.autoRegister, options.autoUnregister]);
  
  return {
    isRegistered: registeredRef.current,
    refCount: toolRegistry.get(options.name)?.refCount || 0,
    // ... manual register/unregister functions
  };
}
```

---

## Context Provider Architecture

The `MCPToolsProvider` adds an additional layer for centralized state management:

```
┌─────────────────────────────────────────────────────────┐
│                  MCPToolsProvider                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  State:                                                  │
│    - isInitialized: boolean                             │
│    - isConnected: boolean                               │
│    - registeredTools: string[]                          │
│                                                          │
│  Methods:                                                │
│    - initialize()                                        │
│    - getConnectionStatus()                              │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         React.Context (MCPToolsContext)         │    │
│  │                                                  │    │
│  │  Provides context value to all children         │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   useMCPToolsContext(strict)  │
         │                               │
         │   Returns context value       │
         └───────────────────────────────┘
```

### With vs Without Provider

**Without Provider:**
```tsx
function App() {
  return <MyComponent />; // Works fine!
}
```

**With Provider:**
```tsx
function App() {
  return (
    <MCPToolsProvider backendWsUrl="ws://localhost:3001">
      <MyComponent />
    </MCPToolsProvider>
  );
}

// Components can now access context:
function StatusBar() {
  const { isConnected, registeredTools } = useMCPToolsContext();
  return <div>Tools: {registeredTools.length}</div>;
}
```

---

## WorkerClient Integration

The library integrates with `@mcp-fe/mcp-worker` through the `WorkerClient`:

```typescript
// Singleton instance
const workerClient = new WorkerClient();

// Initialize (done once, typically by Provider or first hook)
await workerClient.init({
  backendWsUrl: 'ws://localhost:3001',
  workerType: 'service' // or 'shared'
});

// Register tool
await workerClient.registerTool(
  'tool_name',
  async (args) => {
    // Handler implementation
    return { content: [...] };
  }
);

// Unregister tool
await workerClient.unregisterTool('tool_name');
```

---

## Thread Communication

```
Main Thread (React)                   Worker Thread
─────────────────                    ──────────────

useMCPTool()
   ↓
workerClient.registerTool()
   ↓
postMessage({                    →   addEventListener('message')
  type: 'REGISTER_TOOL',                   ↓
  name: 'my_tool',                   Store tool handler
  ...                                      ↓
})                                   Send to MCP backend


AI calls tool via MCP              ←  MCP backend
   ↓                                      ↓
Worker receives CALL_TOOL          ←  postMessage({
   ↓                                     type: 'CALL_TOOL',
Look up handler by name                  name: 'my_tool',
   ↓                                     args: {...}
postMessage({                      →   })
  type: 'EXEC_TOOL',
  handler_id: 'abc',
  args: {...}
})
   ↓
Handler executes in main thread
(full access to React state!)
   ↓
Return result
   ↓
postMessage({                      →   Forward result to MCP
  type: 'TOOL_RESULT',
  result: {...}
})
```

---

## Design Principles

### 1. Zero Re-renders

Tools don't cause unnecessary re-renders:
- Uses `useRef` for handler storage
- Uses `useCallback` with empty deps for stable handler reference
- Registration state stored in refs, not state

### 2. Automatic Cleanup

No memory leaks:
- Tools auto-unregister on component unmount
- Reference counting prevents premature unregistration
- `useEffect` cleanup handles all edge cases

### 3. Main Thread Execution

Handlers run in main thread:
- Full access to React state, props, context
- Can call DOM APIs, navigate, show notifications
- Synchronous communication with UI

### 4. Type Safety

Full TypeScript support:
- Typed handler arguments
- Typed return values
- Typed context values

### 5. Flexible Architecture

Works with or without Context:
- Provider is optional
- Each hook manages its own registration
- Centralized management available when needed

---

## Performance Considerations

### Registration Overhead

- **First registration:** ~1-2ms (postMessage to worker)
- **Subsequent registrations (same tool):** ~0.01ms (ref count increment)
- **Unregistration:** ~1-2ms (if refCount reaches 0)

### Handler Execution

- **Handler invocation:** ~0.1ms (postMessage round-trip)
- **Handler execution:** Depends on your code
- **Result return:** ~0.1ms (postMessage round-trip)

### Memory Usage

- **Per tool:** ~1KB (handler reference + metadata)
- **Registry overhead:** ~100 bytes per tool
- **Worker overhead:** ~500KB (one-time)

---

## Error Handling

```
Component throws error
    ↓
React Error Boundary catches it
    ↓
Tool remains registered (no cleanup triggered)
    ↓
Component may remount
    ↓
refCount increments normally
```

**Best practice:** Use error boundaries and handle errors gracefully in handlers.

---

## Next Steps

- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
- **[Examples](./examples.md)** - Real-world usage examples
- **[API Reference](./api-reference.md)** - Complete API documentation
