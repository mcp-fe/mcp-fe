# Initialization Handling

How the library handles tool registration before worker initialization is complete.

## Problem

Tool registration could fail if called before the worker was fully initialized, causing:
- Registration failures
- Lost registrations
- Race conditions

## Solution

Two-level protection ensures registrations never fail:

## Solution

Two-level protection ensures registrations never fail:

### 1. WorkerClient Level

Queues registrations if worker isn't initialized yet:

```typescript
public async registerTool(...) {
  if (!this.isInitialized) {
    // Queue for later processing
    return new Promise((resolve, reject) => {
      this.pendingRegistrations.push({ name, ..., resolve, reject });
    });
  }
  
  // Already initialized - register immediately
  return this.registerToolInternal(...);
}
```

When init completes, all queued registrations are processed automatically.

### 2. MCPController Level

Queues registrations if MCP server isn't connected yet:

```typescript
public async handleRegisterTool(toolData) {
  if (!this.isMCPServerReady) {
    // Queue until WebSocket connects
    return new Promise((resolve, reject) => {
      this.pendingToolRegistrations.push({ toolData, resolve, reject });
    });
  }
  
  // Server ready - register immediately
  return this.handleRegisterToolInternal(toolData);
}
```

When WebSocket connects, queued registrations are processed.

When WebSocket connects, queued registrations are processed.

## Registration Flow

```
Tool Registration Called
    ↓
Worker Initialized?
    ├─ NO → Queue registration → Wait for init → Process queue
    └─ YES → Send to worker
                ↓
            MCP Server Ready?
                ├─ NO → Queue in controller → Wait for connect → Process queue
                └─ YES → Register tool immediately
                            ↓
                        ✅ Tool Active
```

## API

### Check if Initialized

```typescript
// Check worker state
if (workerClient.initialized) {
  console.log('Worker ready');
}
```

### Wait for Initialization

```typescript
// Wait for worker to be ready
await workerClient.waitForInit();
await workerClient.registerTool(...);
```

## Usage

### Automatic (Recommended)

Just call `registerTool()` - queueing is handled automatically:

```typescript
// Works even if worker isn't initialized yet!
await workerClient.registerTool('my_tool', ...);
```

### React Hook

Use `useMCPTool` - it handles everything:

```typescript
function MyComponent() {
  useMCPTool({
    name: 'my_tool',
    // ... automatically waits for init
  });
}
```

## Scenarios

### Early Registration

```typescript
// Component mounts before worker init
function App() {
  useMCPTool({ name: 'tool1', ... }); // ← Before init
}

// Flow:
// 1. Tool registration queued
// 2. Worker initializes in background
// 3. Queue processed automatically
// 4. Tool registered ✅
```

### Late Registration

```typescript
// Worker already initialized
workerClient.init(); // ← Finishes

// Later...
useMCPTool({ name: 'tool2', ... }); // ← After init

// Flow:
// 1. Worker already ready
// 2. Registers immediately ✅
```

### Multiple Parallel Registrations

```typescript
// Multiple components mount simultaneously
<>
  <ComponentA /> {/* useMCPTool('tool1') */}
  <ComponentB /> {/* useMCPTool('tool2') */}
  <ComponentC /> {/* useMCPTool('tool3') */}
</>

// Flow:
// 1. All queue registrations
// 2. Init completes
// 3. All process together ✅
```

## Benefits

- ✅ **No race conditions** - Always works regardless of timing
- ✅ **Automatic queueing** - No manual coordination needed
- ✅ **Transparent** - User doesn't need to know about init
- ✅ **No lost registrations** - Everything gets processed

## Implementation Notes

For contributors:

- **WorkerClient** queues at `registerTool()` level
- **MCPController** queues at `handleRegisterTool()` level
- Both use Promise-based queues for clean async handling
- Queues are processed in order (FIFO)

See source code for implementation details:
- `libs/mcp-worker/src/lib/worker-client.ts`
- `libs/mcp-worker/src/lib/mcp-controller.ts`


