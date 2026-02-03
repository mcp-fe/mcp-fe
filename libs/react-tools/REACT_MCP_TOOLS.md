# React MCP Tools - Documentation

## 🎯 Overview

React hooks for seamless integration of dynamic MCP tools with automatic lifecycle management and reference counting.

### Key Features:

- ✅ **Automatic registration/unregistration** - on mount/unmount
- ✅ **Reference counting** - same tool can be used multiple times
- ✅ **Re-render safe** - uses refs, no duplicate registrations
- ✅ **Full access** - handler runs in main thread (React state, props, context)
- ✅ **Optional Context** - works with or without Provider
- ✅ **TypeScript** - full type safety

## 🚀 Quick Start

### Basic Usage (without Context)

```tsx
import { useMCPTool } from '@mcp-fe/react-tools-tools';

function MyComponent() {
  const user = useUser(); // React hook
  
  useMCPTool({
    name: 'get_user_profile',
    description: 'Get current user profile',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      // Full access to React state/props/hooks!
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ user })
        }]
      };
    }
  });
  
  return <div>Tool registered!</div>;
}
```

### With Context Provider (recommended for larger apps)

```tsx
import { MCPToolsProvider, useMCPTool } from '@mcp-fe/react-tools-tools';

// 1. Wrap app with Provider
function App() {
  return (
    <MCPToolsProvider backendWsUrl="ws://localhost:3001">
      <MyApp />
    </MCPToolsProvider>
  );
}

// 2. Use hooks in components
function MyComponent() {
  useMCPTool({
    name: 'my_tool',
    description: '...',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ content: [{ type: 'text', text: 'OK' }] })
  });
}
```

## 📚 API Reference

### `useMCPTool(options)`

Main hook for registering MCP tools.

**Options:**
```typescript
{
  name: string;                // Unique tool name
  description: string;          // Description for AI
  inputSchema: object;          // JSON Schema for inputs
  handler: ToolHandler;         // Handler function (runs in main thread!)
  autoRegister?: boolean;       // Auto-register on mount (default: true)
  autoUnregister?: boolean;     // Auto-unregister on unmount (default: true)
}
```

**Returns:**
```typescript
{
  isRegistered: boolean;        // Is tool registered?
  register: () => Promise<void>; // Manual registration
  unregister: () => Promise<void>; // Manual unregistration
  refCount: number;             // Number of components using this tool
}
```

### Helper Hooks

#### `useMCPGetter(name, description, getter)`

For simple getter tools (no inputs).

```tsx
function UserProfile() {
  const user = useUser();
  
  useMCPGetter(
    'get_user_profile',
    'Get current user profile',
    () => ({ userId: user.id, name: user.name })
  );
}
```

#### `useMCPAction(name, description, properties, action)`

For action tools (with inputs).

```tsx
function TodoList() {
  const [todos, setTodos] = useState([]);
  
  useMCPAction(
    'add_todo',
    'Add a new todo',
    {
      text: { type: 'string', description: 'Todo text' }
    },
    async (args: { text: string }) => {
      const newTodo = { id: Date.now(), text: args.text };
      setTodos([...todos, newTodo]);
      return { success: true, todo: newTodo };
    }
  );
}
```

#### `useMCPQuery(name, description, properties, query)`

Alias for `useMCPAction` (semantically for queries).

```tsx
useMCPQuery(
  'search_users',
  'Search users by name',
  {
    query: { type: 'string' },
    limit: { type: 'number', default: 10 }
  },
  async (args) => {
    const results = await searchAPI(args.query, args.limit);
    return results;
  }
);
```


### Utility Functions

#### `isToolRegistered(name: string): boolean`

Check if a tool is registered.

```tsx
import { isToolRegistered } from '@mcp-fe/react-tools-tools';

if (isToolRegistered('my_tool')) {
  console.log('Tool is registered');
}
```

#### `getRegisteredTools(): string[]`

Get list of all registered tool names.

```tsx
import { getRegisteredTools } from '@mcp-fe/react-tools-tools';

const tools = getRegisteredTools();
console.log('Registered tools:', tools);
```

#### `getToolInfo(name: string): { refCount: number; isRegistered: boolean } | null`

Get info about a specific tool.

```tsx
import { getToolInfo } from '@mcp-fe/react-tools-tools';

const info = getToolInfo('my_tool');
console.log('Tool info:', info);
```

### Context API

#### `MCPToolsProvider`

Optional provider for centralized management and monitoring of MCP tools.

**Props:**
```typescript
{
  children: React.ReactNode;
  autoInit?: boolean;              // Auto-initialize on mount (default: true)
  backendWsUrl?: string;           // Backend WebSocket URL
  initOptions?: WorkerClientInitOptions;
  onInitialized?: () => void;      // Callback when initialization completes
  onInitError?: (error: Error) => void; // Callback when initialization fails
}
```

**Example:**
```tsx
function App() {
  return (
    <MCPToolsProvider 
      backendWsUrl="ws://localhost:3001"
      onInitialized={() => console.log('MCP Tools ready!')}
      onInitError={(err) => console.error('Init failed:', err)}
    >
      <YourApp />
    </MCPToolsProvider>
  );
}
```

#### `useMCPToolsContext(strict?: boolean)`

Hook to access MCP Tools context.

**Returns:**
```typescript
{
  isInitialized: boolean;      // Whether the worker client is initialized
  isConnected: boolean;        // Whether connected to MCP server
  registeredTools: string[];   // List of currently registered tool names
  initialize: (options?: WorkerClientInitOptions) => Promise<void>;
  getConnectionStatus: () => Promise<boolean>;
}
```

**Example:**
```tsx
function StatusBar() {
  const { isConnected, registeredTools } = useMCPToolsContext();
  
  return (
    <div>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <p>Tools: {registeredTools.length}</p>
    </div>
  );
}
```

#### `useHasMCPProvider(): boolean`

Hook to check if `MCPToolsProvider` is being used.

```tsx
function MyComponent() {
  const hasProvider = useHasMCPProvider();
  
  if (!hasProvider) {
    console.log('Running without MCPToolsProvider');
  }
}
```

## 🔍 Advanced Usage

### Reference Counting and Multiple Instances

The same tool can be used multiple times - references are automatically counted:

```tsx
// Component A
function ComponentA() {
  const { refCount } = useMCPTool({
    name: 'shared_tool',
    description: 'Shared tool',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ content: [{ type: 'text', text: 'A' }] })
  });
  console.log('Ref count:', refCount); // 1
}

// Component B - SAME tool!
function ComponentB() {
  const { refCount } = useMCPTool({
    name: 'shared_tool',  // <- same name
    description: 'Shared tool',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ content: [{ type: 'text', text: 'B' }] })
  });
  console.log('Ref count:', refCount); // 2
}

// When ComponentA unmounts, tool remains registered
// (because ComponentB is still using it)

// When ComponentB also unmounts, tool is unregistered
```

### Manual Registration Control

```tsx
function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { register, unregister, isRegistered } = useMCPTool({
    name: 'admin_action',
    description: 'Admin-only action',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ content: [{ type: 'text', text: 'Done' }] }),
    autoRegister: false  // ← don't auto-register
  });
  
  useEffect(() => {
    if (isAdmin) {
      register();
    } else {
      unregister();
    }
  }, [isAdmin, register, unregister]);
  
  return (
    <div>
      <button onClick={() => setIsAdmin(!isAdmin)}>
        Toggle Admin ({isRegistered ? 'ON' : 'OFF'})
      </button>
    </div>
  );
}
```

### Handler with Full React Access

Handler function runs in **main thread**, so it has full access:

```tsx
function ShoppingCart() {
  const [items, setItems] = useState([]);
  const user = useAuth();
  const theme = useTheme();
  
  useMCPAction(
    'add_to_cart',
    'Add item to shopping cart',
    {
      productId: { type: 'string' },
      quantity: { type: 'number' }
    },
    async (args: { productId: string; quantity: number }) => {
      // ✅ Access to React state
      const newItem = {
        productId: args.productId,
        quantity: args.quantity,
        addedAt: Date.now()
      };
      setItems([...items, newItem]);
      
      // ✅ Access to React context
      console.log('Current user:', user.name);
      console.log('Theme:', theme.mode);
      
      // ✅ Access to localStorage
      localStorage.setItem('lastAdded', args.productId);
      
      // ✅ Access to DOM
      document.title = `Cart (${items.length + 1})`;
      
      return {
        success: true,
        cartSize: items.length + 1,
        item: newItem
      };
    }
  );
}
```

### Persistent Tools (don't unregister on unmount)

```tsx
function GlobalSettings() {
  useMCPTool({
    name: 'get_app_version',
    description: 'Get application version',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify({ version: '1.0.0' })
      }]
    }),
    autoUnregister: false  // ← persists even after unmount!
  });
}
```

### With Zod Validation

```tsx
import { z } from 'zod';

function UserForm() {
  useMCPAction(
    'create_user',
    'Create a new user',
    {
      username: { type: 'string' },
      email: { type: 'string' },
      age: { type: 'number' }
    },
    async (args: unknown) => {
      // Validation with Zod
      const schema = z.object({
        username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
        email: z.string().email(),
        age: z.number().min(18).max(120)
      });
      
      try {
        const validated = schema.parse(args);
        
        // Create user
        const user = await createUser(validated);
        
        return { success: true, user };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            success: false,
            errors: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          };
        }
        throw error;
      }
    }
  );
}
```

## 🏗️ Architecture

### Reference Counting Flow

```
Component A mounts
  ↓
useMCPTool('my_tool')
  ↓
toolRegistry.get('my_tool') === undefined
  ↓
workerClient.registerTool('my_tool')
  ↓
toolRegistry.set('my_tool', { refCount: 1 })

---

Component B mounts (SAME tool!)
  ↓
useMCPTool('my_tool')
  ↓
toolRegistry.get('my_tool') === { refCount: 1 }
  ↓
Increment: toolRegistry.set('my_tool', { refCount: 2 })
  ↓
SKIP workerClient.registerTool() (already registered)

---

Component A unmounts
  ↓
Decrement: refCount: 2 → 1
  ↓
SKIP workerClient.unregisterTool() (refCount > 0)

---

Component B unmounts
  ↓
Decrement: refCount: 1 → 0
  ↓
workerClient.unregisterTool('my_tool')
  ↓
toolRegistry.delete('my_tool')
```

### Handler Update Flow

```
Component renders with new handler
  ↓
useMCPTool({ handler: newHandler })
  ↓
handlerRef.current = newHandler  ← update ref
  ↓
stableHandler remains stable
  ↓
Next CALL_TOOL uses newHandler
```

Handler is automatically updated without re-registration!

## 🎨 Use Cases Examples

### 1. Todo List Manager

```tsx
function TodoManager() {
  const [todos, setTodos] = useState([]);
  
  // List todos
  useMCPGetter('list_todos', 'List all todos', () => todos);
  
  // Add todo
  useMCPAction(
    'add_todo',
    'Add a new todo',
    { text: { type: 'string' } },
    async (args: { text: string }) => {
      const todo = { id: Date.now(), text: args.text, done: false };
      setTodos([...todos, todo]);
      return todo;
    }
  );
  
  // Toggle todo
  useMCPAction(
    'toggle_todo',
    'Toggle todo completion',
    { id: { type: 'number' } },
    async (args: { id: number }) => {
      setTodos(todos.map(t => 
        t.id === args.id ? { ...t, done: !t.done } : t
      ));
      return { success: true };
    }
  );
}
```

### 2. Form Integration

```tsx
function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  
  useMCPGetter(
    'get_form_data',
    'Get current form data',
    () => formData
  );
  
  useMCPAction(
    'fill_form',
    'Fill contact form',
    {
      name: { type: 'string' },
      email: { type: 'string' }
    },
    async (args: { name: string; email: string }) => {
      setFormData(args);
      return { success: true, data: args };
    }
  );
}
```

### 3. API Integration

```tsx
function DataFetcher() {
  const [data, setData] = useState(null);
  
  useMCPAction(
    'fetch_data',
    'Fetch data from API',
    {
      endpoint: { type: 'string' },
      params: { type: 'object' }
    },
    async (args: { endpoint: string; params: Record<string, unknown> }) => {
      try {
        const response = await fetch(
          `/api/${args.endpoint}?${new URLSearchParams(args.params as any)}`
        );
        const data = await response.json();
        setData(data);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );
}
```

## 🐛 Troubleshooting

### Tool registers multiple times

**Problem:** Handler is called on every re-render

**Solution:** Hook automatically uses refs - this shouldn't happen. Check console for `[useMCPTool]` logs.

### Handler doesn't have current state

**Problem:** Handler uses stale state

**Solution:** Hook automatically updates handler ref. Make sure you're using the latest version.

### Tool doesn't unregister

**Problem:** Tool remains even after all components unmount

**Solution:** Check `autoUnregister: true` (default). Or explicitly call `unregister()`.

### Context error

**Error:** `useMCPToolsContext must be used within MCPToolsProvider`

**Solution:** Either add `<MCPToolsProvider>` or use `useMCPToolsContext(false)` (non-strict mode).

## 📝 Best Practices

1. **Tool naming:** Use snake_case (`get_user_profile`, not `getUserProfile`)
2. **Descriptions:** Be specific - AI uses description to make decisions
3. **Validation:** Always validate inputs (Zod, JSON Schema)
4. **Error handling:** Return useful error messages
5. **Reference counting:** Let the hook manage lifecycle automatically
6. **Context:** Use Provider for larger apps, not needed for small ones

## 🚀 Migration from WorkerClient

**Before (manual):**
```tsx
const client = new WorkerClient();
await client.init();
await client.registerTool(/* ... */);
// Manual cleanup
useEffect(() => {
  return () => client.unregisterTool('my_tool');
}, []);
```

**After (with hook):**
```tsx
useMCPTool({
  name: 'my_tool',
  description: '...',
  inputSchema: {},
  handler: async () => ({ content: [{ type: 'text', text: 'OK' }] })
});
// Automatic cleanup! 🎉
```
