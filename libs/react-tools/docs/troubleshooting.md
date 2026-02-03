# Troubleshooting

Common issues and their solutions when using `@mcp-fe/react-tools`.

## Common Issues

### Tool Registers Multiple Times

**Symptoms:**
- Console shows multiple registration messages for the same tool
- Handler is called multiple times per invocation
- `refCount` keeps increasing unexpectedly

**Causes:**
1. Tool name changes on each render
2. Handler function recreated on each render (causing effect to re-run)
3. Dependencies in custom effect wrapping

**Solutions:**

```tsx
// ❌ BAD: Tool name depends on state
function MyComponent() {
  const [id, setId] = useState(1);
  
  useMCPTool({
    name: `tool_${id}`,  // ← Changes on every state update!
    // ...
  });
}

// ✅ GOOD: Use stable tool name
function MyComponent() {
  const [id, setId] = useState(1);
  
  useMCPTool({
    name: 'my_tool',  // ← Stable name
    handler: async () => {
      // Use current id value here
      return { content: [{ type: 'text', text: `ID: ${id}` }] };
    }
  });
}
```

---

### Handler Has Stale State

**Symptoms:**
- Handler uses old state values
- Handler doesn't reflect recent prop changes
- State updates don't affect handler behavior

**Cause:**
This should NOT happen with the current implementation (handlers are automatically updated via refs).

**Solution:**

If you're experiencing this, verify you're using the latest version:

```bash
npm update @mcp-fe/react-tools
# or
pnpm update @mcp-fe/react-tools
```

**Verify handler updates:**

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  
  useMCPGetter('get_count', 'Get counter', () => {
    console.log('Handler called with count:', count); // Should always be current
    return { count };
  });
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

---

### Tool Doesn't Unregister

**Symptoms:**
- Tool remains registered after component unmounts
- `getRegisteredTools()` shows tools that should be gone
- Memory leak over time

**Causes:**
1. `autoUnregister: false` option set
2. Multiple components using the same tool (refCount > 0)
3. Component didn't unmount cleanly

**Solutions:**

```tsx
// Check autoUnregister setting
useMCPTool({
  name: 'my_tool',
  // ...
  autoUnregister: true  // ← Default, but verify
});

// Check reference count
const { refCount } = useMCPTool({
  name: 'shared_tool',
  // ...
});
console.log('Ref count:', refCount); // Should be > 0 if still in use

// Manual cleanup if needed
const { unregister } = useMCPTool({
  name: 'my_tool',
  // ...
});

useEffect(() => {
  return () => {
    unregister(); // Force unregister
  };
}, []);
```

---

### Context Error

**Error Message:**
```
Error: useMCPToolsContext must be used within MCPToolsProvider
```

**Cause:**
Using `useMCPToolsContext()` outside of `<MCPToolsProvider>`.

**Solutions:**

**Option 1:** Add Provider
```tsx
function App() {
  return (
    <MCPToolsProvider backendWsUrl="ws://localhost:3001">
      <YourApp />
    </MCPToolsProvider>
  );
}
```

**Option 2:** Use non-strict mode
```tsx
function MyComponent() {
  const context = useMCPToolsContext(false); // ← Non-strict
  
  if (!context) {
    console.log('No provider, using standalone mode');
    return null;
  }
  
  return <div>Connected: {context.isConnected}</div>;
}
```

**Option 3:** Use `useHasMCPProvider()`
```tsx
function MyComponent() {
  const hasProvider = useHasMCPProvider();
  
  if (hasProvider) {
    const { isConnected } = useMCPToolsContext();
    return <div>Connected: {isConnected}</div>;
  }
  
  return <div>No provider</div>;
}
```

---

### Worker Initialization Fails

**Symptoms:**
- Tools don't work
- Console shows worker errors
- Connection never establishes

**Causes:**
1. Worker file not found
2. Backend WebSocket URL incorrect
3. CORS issues
4. Service Worker registration failed

**Solutions:**

**Check initialization:**
```tsx
<MCPToolsProvider
  backendWsUrl="ws://localhost:3001"  // ← Verify URL
  onInitialized={() => console.log('✅ Initialized')}
  onInitError={(err) => console.error('❌ Init failed:', err)}
>
  <App />
</MCPToolsProvider>
```

**Manual initialization:**
```tsx
import { WorkerClient } from '@mcp-fe/mcp-worker';

const client = new WorkerClient();

try {
  await client.init({
    backendWsUrl: 'ws://localhost:3001',
    workerType: 'service' // or 'shared'
  });
  console.log('✅ Worker initialized');
} catch (error) {
  console.error('❌ Initialization failed:', error);
}
```

---

### TypeScript Errors

**Error:** `Type 'X' is not assignable to type 'Y'`

**Handler typing:**
```tsx
// Define argument types
interface AddTodoArgs {
  text: string;
  priority?: number;
}

useMCPAction(
  'add_todo',
  'Add todo',
  {
    text: { type: 'string' },
    priority: { type: 'number', default: 0 }
  },
  async (args: AddTodoArgs) => {  // ← Type the args
    // TypeScript knows args.text is string
    return { success: true };
  }
);
```

**Return type errors:**
```tsx
// Ensure proper return type
useMCPTool({
  name: 'my_tool',
  // ...
  handler: async (args): Promise<ToolCallResult> => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ result: 'ok' })
      }]
    };
  }
});
```

---

### Performance Issues

**Symptoms:**
- App feels slow
- High CPU usage
- Memory increasing over time

**Causes:**
1. Too many tools registered
2. Handler doing heavy computation
3. Memory leaks from closures

**Solutions:**

**1. Limit tool count:**
```tsx
// ❌ BAD: Tool per item
{items.map(item => (
  <TodoItem key={item.id} item={item}>
    <useMCPTool name={`tool_${item.id}`} ... />
  </TodoItem>
))}

// ✅ GOOD: One tool for all items
function TodoList() {
  useMCPAction(
    'update_todo',
    'Update any todo',
    { id: { type: 'number' }, text: { type: 'string' } },
    async (args) => { /* ... */ }
  );
  
  return items.map(item => <TodoItem key={item.id} item={item} />);
}
```

**2. Optimize handlers:**
```tsx
// ❌ BAD: Heavy computation in handler
useMCPGetter('get_data', 'Get data', () => {
  return expensiveComputation(largeDataset);
});

// ✅ GOOD: Memoize expensive computations
const memoizedData = useMemo(
  () => expensiveComputation(largeDataset),
  [largeDataset]
);

useMCPGetter('get_data', 'Get data', () => memoizedData);
```

**3. Avoid memory leaks:**
```tsx
// ❌ BAD: Closure captures growing array
useMCPAction('add_item', 'Add item', 
  { item: { type: 'string' } },
  async (args) => {
    items.push(args.item); // ← Mutating captured variable!
    return { success: true };
  }
);

// ✅ GOOD: Use state setter
useMCPAction('add_item', 'Add item',
  { item: { type: 'string' } },
  async (args) => {
    setItems(prev => [...prev, args.item]);
    return { success: true };
  }
);
```

---

### Tool Not Found by AI

**Symptoms:**
- AI says "tool not available"
- Tool is registered but not called
- AI doesn't know about the tool

**Causes:**
1. Tool description too vague
2. Tool name doesn't match AI's expectations
3. Backend not forwarding tools to AI

**Solutions:**

**1. Improve description:**
```tsx
// ❌ BAD: Vague description
useMCPGetter('get_data', 'Get data', () => data);

// ✅ GOOD: Specific description
useMCPGetter(
  'get_user_profile',
  'Get the current logged-in user\'s profile information including name, email, and preferences',
  () => userProfile
);
```

**2. Use clear naming:**
```tsx
// ✅ Use snake_case, be descriptive
useMCPTool({ name: 'get_shopping_cart_items', ... });
useMCPTool({ name: 'create_new_todo_item', ... });
useMCPTool({ name: 'search_users_by_name', ... });
```

**3. Verify registration:**
```tsx
import { getRegisteredTools } from '@mcp-fe/react-tools';

useEffect(() => {
  const tools = getRegisteredTools();
  console.log('Registered tools:', tools);
}, []);
```

---

## Best Practices

### 1. Stable Tool Names

Always use constant strings for tool names:

```tsx
// ✅ GOOD
const TOOL_NAME = 'my_tool';
useMCPTool({ name: TOOL_NAME, ... });

// ❌ BAD
useMCPTool({ name: `tool_${Math.random()}`, ... });
```

### 2. Descriptive Descriptions

Write descriptions as if explaining to a human:

```tsx
useMCPTool({
  name: 'update_user_settings',
  description: 'Update the user\'s application settings including theme, language, notifications, and accessibility options',
  // ...
});
```

### 3. Input Validation

Always validate inputs:

```tsx
useMCPAction(
  'create_user',
  'Create a new user',
  {
    username: { type: 'string', minLength: 3, maxLength: 20 },
    email: { type: 'string', format: 'email' }
  },
  async (args) => {
    // Additional validation if needed
    if (!args.username.match(/^[a-zA-Z0-9_]+$/)) {
      return { success: false, error: 'Invalid username format' };
    }
    // ...
  }
);
```

### 4. Error Handling

Always handle errors gracefully:

```tsx
useMCPAction('fetch_data', 'Fetch data',
  { url: { type: 'string' } },
  async (args) => {
    try {
      const response = await fetch(args.url);
      const data = await response.json();
      return {
        content: [{ type: 'text', text: JSON.stringify(data) }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }],
        isError: true
      };
    }
  }
);
```

---

## Migration from Manual Registration

**Before:**
```tsx
const client = new WorkerClient();

useEffect(() => {
  client.init().then(() => {
    client.registerTool('my_tool', handler);
  });
  
  return () => {
    client.unregisterTool('my_tool');
  };
}, []);
```

**After:**
```tsx
useMCPTool({
  name: 'my_tool',
  description: 'My tool',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({ content: [{ type: 'text', text: 'OK' }] })
});
// That's it! Automatic lifecycle management 🎉
```

---

## Getting Help

If you're still experiencing issues:

1. **Check version:** Ensure you're using the latest version
2. **Check console:** Look for error messages or warnings
3. **Check network:** Verify WebSocket connection is established
4. **Minimal reproduction:** Create a minimal example that reproduces the issue
5. **Report issue:** Open an issue on [GitHub](https://github.com/mcp-fe/mcp-fe/issues)

---

## Next Steps

- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Examples](./examples.md)** - Working code examples
- **[Architecture](./architecture.md)** - Understand the internals
