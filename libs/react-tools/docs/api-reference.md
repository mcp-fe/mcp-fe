# API Reference

Complete reference for all hooks, components, and utilities in `@mcp-fe/react-tools`.

## Hooks

### `useMCPTool(options)`

Main hook for registering MCP tools with automatic lifecycle management.

#### Parameters

```typescript
interface UseMCPToolOptions {
  name: string;                // Unique tool name (required)
  description: string;          // Description for AI (required)
  inputSchema: object;          // JSON Schema for inputs (required)
  handler: ToolHandler;         // Handler function (required)
  autoRegister?: boolean;       // Auto-register on mount (default: true)
  autoUnregister?: boolean;     // Auto-unregister on unmount (default: true)
}
```

#### Returns

```typescript
interface UseMCPToolResult {
  isRegistered: boolean;              // Is tool currently registered?
  register: () => Promise<void>;      // Manual registration
  unregister: () => Promise<void>;    // Manual unregistration
  refCount: number;                   // Number of components using this tool
}
```

#### Example

```tsx
const { isRegistered, refCount } = useMCPTool({
  name: 'my_tool',
  description: 'My custom tool',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string' }
    },
    required: ['param']
  },
  handler: async (args: { param: string }) => {
    // Your logic here
    return {
      content: [{
        type: 'text',
        text: `Result: ${args.param}`
      }]
    };
  }
});
```

---

### `useMCPGetter(name, description, getter)`

Simplified hook for getter tools (no inputs required).

#### Parameters

```typescript
useMCPGetter(
  name: string,              // Tool name
  description: string,       // Tool description
  getter: () => any          // Function that returns data
)
```

#### Returns

Same as `useMCPTool`.

#### Example

```tsx
function UserProfile() {
  const user = useUser();
  
  useMCPGetter(
    'get_user_profile',
    'Get current user profile',
    () => ({ 
      userId: user.id, 
      name: user.name 
    })
  );
}
```

---

### `useMCPAction(name, description, properties, action)`

Hook for action tools that accept inputs and perform operations.

#### Parameters

```typescript
useMCPAction(
  name: string,                    // Tool name
  description: string,             // Tool description
  properties: Record<string, any>, // JSON Schema properties
  action: (args: any) => Promise<any> // Action handler
)
```

#### Returns

Same as `useMCPTool`.

#### Example

```tsx
function TodoManager() {
  const [todos, setTodos] = useState([]);
  
  useMCPAction(
    'add_todo',
    'Add a new todo',
    {
      text: { type: 'string', description: 'Todo text' },
      priority: { type: 'number', default: 0 }
    },
    async (args: { text: string; priority: number }) => {
      const newTodo = { 
        id: Date.now(), 
        text: args.text,
        priority: args.priority 
      };
      setTodos([...todos, newTodo]);
      return { success: true, todo: newTodo };
    }
  );
}
```

---

### `useMCPQuery(name, description, properties, query)`

Alias for `useMCPAction`, semantically used for query operations.

#### Parameters

Same as `useMCPAction`.

#### Example

```tsx
useMCPQuery(
  'search_users',
  'Search users by name',
  {
    query: { type: 'string' },
    limit: { type: 'number', default: 10 }
  },
  async (args: { query: string; limit: number }) => {
    const results = await searchAPI(args.query, args.limit);
    return results;
  }
);
```

---

## Context API

### `MCPToolsProvider`

Provider component for centralized management and monitoring of MCP tools.

#### Props

```typescript
interface MCPToolsProviderProps {
  children: React.ReactNode;
  autoInit?: boolean;                      // Auto-initialize on mount (default: true)
  backendWsUrl?: string;                   // Backend WebSocket URL
  initOptions?: WorkerClientInitOptions;   // Custom initialization options
  onInitialized?: () => void;              // Callback when initialized
  onInitError?: (error: Error) => void;    // Callback on init error
}
```

#### Example

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

---

### `useMCPToolsContext(strict?)`

Hook to access MCP Tools context state and methods.

#### Parameters

```typescript
useMCPToolsContext(strict?: boolean) // default: true
```

If `strict` is `true`, throws an error when used outside `MCPToolsProvider`.

#### Returns

```typescript
interface MCPToolsContextValue {
  isInitialized: boolean;           // Whether worker client is initialized
  isConnected: boolean;             // Whether connected to MCP server
  registeredTools: string[];        // List of currently registered tool names
  initialize: (options?: WorkerClientInitOptions) => Promise<void>;
  getConnectionStatus: () => Promise<boolean>;
}
```

#### Example

```tsx
function StatusBar() {
  const { isConnected, registeredTools } = useMCPToolsContext();
  
  return (
    <div>
      <p>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <p>Active Tools: {registeredTools.length}</p>
    </div>
  );
}
```

---

### `useHasMCPProvider()`

Check if component is rendered within `MCPToolsProvider`.

#### Returns

```typescript
boolean // true if provider exists
```

#### Example

```tsx
function MyComponent() {
  const hasProvider = useHasMCPProvider();
  
  if (!hasProvider) {
    console.log('Running in standalone mode');
  }
  
  return <div>Component</div>;
}
```

---

## Utility Functions

### `isToolRegistered(name)`

Check if a tool is currently registered.

#### Parameters

```typescript
isToolRegistered(name: string): boolean
```

#### Example

```tsx
import { isToolRegistered } from '@mcp-fe/react-tools';

if (isToolRegistered('my_tool')) {
  console.log('Tool is registered');
}
```

---

### `getRegisteredTools()`

Get list of all registered tool names.

#### Returns

```typescript
string[] // Array of tool names
```

#### Example

```tsx
import { getRegisteredTools } from '@mcp-fe/react-tools';

const tools = getRegisteredTools();
console.log('Registered tools:', tools);
// Output: ['get_user_profile', 'add_todo', 'search_users']
```

---

### `getToolInfo(name)`

Get detailed information about a specific tool.

#### Parameters

```typescript
getToolInfo(name: string): ToolInfo | null
```

#### Returns

```typescript
interface ToolInfo {
  refCount: number;      // Number of active references
  isRegistered: boolean; // Registration status
}
```

#### Example

```tsx
import { getToolInfo } from '@mcp-fe/react-tools';

const info = getToolInfo('my_tool');
if (info) {
  console.log(`Tool is used by ${info.refCount} component(s)`);
}
```

---

## Types

### `ToolHandler`

```typescript
type ToolHandler = (args: any) => Promise<ToolCallResult>;

interface ToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    // ... other content types
  }>;
  isError?: boolean;
}
```

### `WorkerClientInitOptions`

```typescript
interface WorkerClientInitOptions {
  backendWsUrl?: string;
  workerType?: 'service' | 'shared';
  workerUrl?: string;
  // ... other options
}
```

---

## Next Steps

- **[Guides](./guides.md)** - Learn advanced usage patterns
- **[Examples](./examples.md)** - See real-world implementations
- **[Architecture](./architecture.md)** - Understand how it works internally
