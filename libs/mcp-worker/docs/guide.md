# Dynamic Tool Registration Guide

Learn how to register custom MCP tools that run in your browser with full access to all APIs.

## How It Works

**Handlers run in the main thread**, not in the worker. This means you have full access to:

- ✅ React context, hooks, state
- ✅ DOM API, localStorage, fetch
- ✅ All your imports and dependencies
- ✅ Closures and external variables

The worker acts as a **proxy**, forwarding calls between the MCP protocol and your handler.

```
MCP Client → Worker (proxy) → Your Handler (main thread) → Result
```

## Quick Start

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

// Initialize
await workerClient.init({
  backendWsUrl: 'ws://localhost:3001'
});

// Register a tool
await workerClient.registerTool(
  'get_time',
  'Get current time',
  { type: 'object', properties: {} },
  async () => ({
    content: [{
      type: 'text',
      text: new Date().toISOString()
    }]
  })
);
```

## API

### `workerClient.registerTool(name, description, inputSchema, handler)`

Register a new MCP tool.

**Parameters:**
- `name` (string) - Tool name (use snake_case)
- `description` (string) - What the tool does (AI uses this)
- `inputSchema` (object) - JSON Schema for input validation
- `handler` (function) - Async function that handles the tool execution

**Returns:** `Promise<void>`

**Example:**
```typescript
await workerClient.registerTool(
  'calculate',
  'Perform arithmetic operations',
  {
    type: 'object',
    properties: {
      operation: { 
        type: 'string', 
        enum: ['add', 'subtract', 'multiply', 'divide'] 
      },
      a: { type: 'number' },
      b: { type: 'number' }
    },
    required: ['operation', 'a', 'b']
  },
  async (args: any) => {
    const { operation, a, b } = args;
    let result: number;
    
    switch (operation) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide':
        if (b === 0) {
          throw new Error('Division by zero');
        }
        result = a / b;
        break;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ operation, a, b, result })
      }]
    };
  }
);
```

### `workerClient.unregisterTool(name)`

Unregister a previously registered tool.

**Parameters:**
- `name` (string) - Tool name to unregister

**Returns:** `Promise<boolean>` - True if tool was found and removed

**Example:**
```typescript
const success = await workerClient.unregisterTool('calculate');
if (success) {
  console.log('Tool unregistered');
}
```

## Handler Function

The handler receives the tool arguments and must return a result in MCP format.

**Signature:**
```typescript
async (args: unknown) => Promise<{
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}>
```

**Example with validation:**
```typescript
import { z } from 'zod';

const handler = async (args: unknown) => {
  // Validate input
  const schema = z.object({
    username: z.string().min(3),
    email: z.string().email()
  });
  
  try {
    const validated = schema.parse(args);
    
    // Your logic here
    const result = await createUser(validated);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          error: error.message 
        })
      }]
    };
  }
};
```

## Common Patterns

### Accessing React State

```typescript
function MyComponent() {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    workerClient.registerTool(
      'get_todos',
      'Get all todos',
      { type: 'object', properties: {} },
      async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify(todos)
        }]
      })
    );
  }, [todos]);
}
```

### Using External APIs

```typescript
await workerClient.registerTool(
  'fetch_weather',
  'Get weather for a city',
  {
    type: 'object',
    properties: {
      city: { type: 'string' }
    }
  },
  async (args: any) => {
    const response = await fetch(
      `https://api.weather.com/data?city=${args.city}`
    );
    const data = await response.json();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data)
      }]
    };
  }
);
```

### Accessing localStorage

```typescript
await workerClient.registerTool(
  'get_settings',
  'Get user settings',
  { type: 'object', properties: {} },
  async () => {
    const theme = localStorage.getItem('theme') || 'light';
    const language = localStorage.getItem('lang') || 'en';
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ theme, language })
      }]
    };
  }
);
```

### Accessing DOM

```typescript
await workerClient.registerTool(
  'get_page_info',
  'Get current page information',
  { type: 'object', properties: {} },
  async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({
        title: document.title,
        url: window.location.href,
        headings: document.querySelectorAll('h1, h2').length
      })
    }]
  })
);
```

## Best Practices

### 1. Tool Naming

Use **snake_case** for tool names:

```typescript
// ✅ Good
'get_user_profile'
'create_todo'
'fetch_data'

// ❌ Bad
'getUserProfile'
'CreateTodo'
'fetch-data'
```

### 2. Descriptions

Write clear, specific descriptions. The AI uses these to decide when to call your tool:

```typescript
// ✅ Good
'Get the current user profile including username, email, and avatar'

// ❌ Bad
'Get user'
```

### 3. Input Validation

Always validate inputs:

```typescript
// ✅ Good - with validation
const handler = async (args: unknown) => {
  const schema = z.object({
    email: z.string().email()
  });
  const validated = schema.parse(args);
  // ...
};

// ❌ Bad - no validation
const handler = async (args: any) => {
  const email = args.email; // Could be anything!
  // ...
};
```

### 4. Error Handling

Return helpful error messages:

```typescript
try {
  const result = await doSomething();
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result)
    }]
  };
} catch (error) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: error.message,
        // Include context to help debug
        input: args
      })
    }]
  };
}
```

### 5. TypeScript

Use proper types for better developer experience:

```typescript
interface CalculateArgs {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
}

const handler = async (args: unknown) => {
  const { operation, a, b } = args as CalculateArgs;
  // TypeScript knows the types now
};
```

## Testing

Handlers are normal async functions - easy to test:

```typescript
// Define handler
const myHandler = async (args: unknown) => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ result: 'ok' })
    }]
  };
};

// Test it
test('myHandler returns ok', async () => {
  const result = await myHandler({});
  expect(result.content[0].text).toContain('ok');
});

// Then register
await workerClient.registerTool('my_tool', '...', {}, myHandler);
```

## Examples

See [examples/](../examples/) for complete, runnable examples:

- [quick-start.ts](../examples/quick-start.ts) - Simple examples
- [dynamic-tools.ts](../examples/dynamic-tools.ts) - Advanced patterns

## React Integration

For React applications, use the `useMCPTool` hook for automatic lifecycle management:

```typescript
import { useMCPTool } from '@mcp-fe/react-event-tracker';

function MyComponent() {
  useMCPTool({
    name: 'my_tool',
    description: 'My tool',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      content: [{ type: 'text', text: 'Hello!' }]
    })
  });
  // Automatically registered on mount, unregistered on unmount
}
```

See [React Hooks Guide](../../react-event-tracker/REACT_MCP_TOOLS.md) for details.

## Multi-Tab Applications

The library automatically handles multiple browser tabs with intelligent routing.

### How It Works

Each tab gets a unique ID (via `crypto.randomUUID()`) stored in `sessionStorage`. Tools are registered per-tab, and the worker routes calls intelligently.

### Automatic Routing (Smart Strategy)

**Without `tabId` parameter**: Intelligently routes based on availability and focus

```typescript
// In any tab
await workerClient.registerTool(
  'get_page_url',
  'Get current page URL',
  { type: 'object', properties: {} },
  async () => ({
    content: [{
      type: 'text',
      text: window.location.href
    }]
  })
);

// Scenario 1: Only one tab has the tool
// Tab A: Has get_page_url
// Tab B: Doesn't have get_page_url (active)
get_page_url()
// → Automatically routes to Tab A (even though Tab B is active!)
// No error, tool "just works"

// Scenario 2: Multiple tabs have the tool
// Tab A: Has get_page_url
// Tab B: Has get_page_url (active)
get_page_url()
// → Routes to Tab B (active tab preferred when multiple available)
```

**With `tabId` parameter**: Routes to specific tab precisely

```typescript
// First, discover available tabs
list_browser_tabs()
// → [
//   { tabId: "abc-123", url: "/dashboard", title: "Dashboard", isActive: true },
//   { tabId: "def-456", url: "/settings", title: "Settings", isActive: false }
// ]

// Then target a specific tab
get_page_url({ tabId: "def-456" })
// → Routes to Settings tab specifically
```

### Built-in Meta Tool

**`list_browser_tabs`**: Always available, lists all active tabs

```typescript
// Returns array of:
{
  tabId: string;      // Unique tab identifier
  url: string;        // Current URL
  title: string;      // Page title
  isActive: boolean;  // Is this the focused tab?
  lastSeen: string;   // ISO timestamp of last activity
}
```

### Reference Counting

When multiple tabs register the same tool:
- Tool is registered once with MCP
- Worker tracks all tabs that have the tool
- Unregistration happens when last tab unmounts
- Handler is always from the target tab's context

### Tab Persistence

Tab IDs persist across page refreshes (stored in `sessionStorage`):
- Same tab keeps same ID after F5
- Duplicate tab (Ctrl+K) gets new ID
- New tab/window gets new ID

### Use Cases

**1. Compare data across tabs:**
```typescript
// Get state from multiple tabs
const dashboardState = await get_react_state({ tabId: "tab-1" });
const settingsState = await get_react_state({ tabId: "tab-2" });
```

**2. Debug specific tab:**
```typescript
// Agent: "Show me the state of the Settings tab"
list_browser_tabs()
// Find tabId for Settings
get_react_state({ tabId: "settings-tab-id" })
```

**3. Focus-driven interaction:**
```typescript
// Agent: "What's on the current page?"
get_page_info()  // No tabId needed - uses focused tab
```

### Debugging Multi-Tab

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

// Get current tab info
console.log(workerClient.getTabInfo());
// → { tabId: "abc-123", isActive: true, url: "/dashboard", title: "Dashboard" }

// Clear and regenerate tab ID (for testing)
WorkerClient.clearTabId();
// Refresh page to get new ID
```

## Troubleshooting

### Tool doesn't register

Check that the worker is initialized:

```typescript
await workerClient.init();
console.log(workerClient.initialized); // should be true
```

### Handler not called

Verify the tool name matches exactly:

```typescript
// Registration
await workerClient.registerTool('get_user', ...);

// MCP call must use: 'get_user' (exact match)
```

### Arguments not received

Check your input schema matches what the AI sends:

```typescript
// Schema says: { email: string }
inputSchema: {
  type: 'object',
  properties: {
    email: { type: 'string' }
  }
}

// Handler receives: { email: 'test@example.com' }
```

## Next Steps

- [Architecture](./architecture.md) - How the proxy pattern works
- [Initialization](./initialization.md) - Init queue handling
- [Examples](../examples/) - Runnable code examples
