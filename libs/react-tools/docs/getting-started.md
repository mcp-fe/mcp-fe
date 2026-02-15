# Getting Started

## ⚠️ Prerequisites

Before using `@mcp-fe/react-tools`, you must first set up **[@mcp-fe/mcp-worker](https://www.npmjs.com/package/@mcp-fe/mcp-worker)**.

The `react-tools` library provides React hooks that communicate with the MCP server running in your browser via the `mcp-worker` library. Without the worker, these hooks will not function.

**Required setup:**

1. Install both packages
2. Initialize the WorkerClient (from `@mcp-fe/mcp-worker`)
3. Use the React hooks (from `@mcp-fe/react-tools`)

> 💡 **New to MCP Worker?** Read the [@mcp-fe/mcp-worker documentation](https://www.npmjs.com/package/@mcp-fe/mcp-worker) first to understand the architecture and setup.

## 📦 Installation

Install both packages using your preferred package manager:

```bash
npm install @mcp-fe/mcp-worker @mcp-fe/react-tools
```

```bash
pnpm add @mcp-fe/mcp-worker @mcp-fe/react-tools
```

```bash
yarn add @mcp-fe/mcp-worker @mcp-fe/react-tools
```

## 🔧 Initial Setup

You have **two options** for initializing the MCP Worker Client:

1. **Option A: Use `MCPToolsProvider`** (Recommended) - Initialize within React
2. **Option B: Manual Initialization** - Initialize outside React

Choose the option that best fits your application architecture.

---

### Option A: Using `MCPToolsProvider` (Recommended)

The easiest way to get started is to wrap your app with `MCPToolsProvider`. This handles initialization automatically and provides React context for all hooks.

```tsx
import { MCPToolsProvider } from '@mcp-fe/react-tools';

function App() {
  return (
    <MCPToolsProvider 
      backendWsUrl="ws://localhost:3001"
      authToken="your-auth-token" // optional
      onInitialized={() => console.log('MCP ready!')}
      onInitError={(err) => console.error('MCP init failed:', err)}
    >
      <MyApp />
    </MCPToolsProvider>
  );
}
```

**Benefits:**
- ✅ Automatic initialization on mount
- ✅ Built-in connection status tracking
- ✅ Auth token management with automatic updates
- ✅ Centralized error handling
- ✅ No manual setup required

**With dynamic auth token:**

```tsx
function App() {
  const [token, setToken] = useState<string>();

  useEffect(() => {
    // Token automatically updates when state changes
    authService.getToken().then(setToken);
  }, []);

  return (
    <MCPToolsProvider 
      backendWsUrl="ws://localhost:3001"
      authToken={token}
    >
      <MyApp />
    </MCPToolsProvider>
  );
}
```

---

### Option B: Manual Initialization (Outside React)

If you need more control or want to initialize outside of React (e.g., before the app mounts), you can manually initialize the `WorkerClient`:

```tsx
import { workerClient } from '@mcp-fe/mcp-worker';

// Initialize early in your application (e.g., in main.tsx or app.ts)
async function initMCP() {
  await workerClient.init({
    backendWsUrl: 'ws://localhost:3001'
  });
  
  // Optional: Set auth token
  workerClient.setAuthToken('your-auth-token');
  
  console.log('MCP Worker initialized');
}

// Call before rendering React
initMCP().then(() => {
  // Now render your React app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
  );
});
```

**Benefits:**
- ✅ Full control over initialization timing
- ✅ Initialize before React mounts
- ✅ Useful for non-React parts of your app
- ✅ Can be used with any state management

> ⚠️ **Important**: When using manual initialization, the worker must be initialized before any components using `@mcp-fe/react-tools` hooks are mounted.

---

### After Initialization

Once initialized (via either option), you can use React hooks in your components:

```tsx
import { useMCPTool } from '@mcp-fe/react-tools';

function MyComponent() {
  const user = useUser();
  
  useMCPTool({
    name: 'get_user_profile',
    description: 'Get current user profile',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
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

## 🚀 Usage Patterns

### Pattern 1: With MCPToolsProvider (Recommended)

Use `MCPToolsProvider` to handle initialization and provide context to your entire app:

```tsx
import { MCPToolsProvider, useMCPTool } from '@mcp-fe/react-tools';

// 1. Wrap your app with the Provider
function App() {
  return (
    <MCPToolsProvider 
      backendWsUrl="ws://localhost:3001" 
      authToken="Bearer 123"
    >
      <MyApp />
    </MCPToolsProvider>
  );
}

// 2. Use hooks in your components
function MyComponent() {
  useMCPTool({
    name: 'my_tool',
    description: 'My awesome tool',
    inputSchema: { 
      type: 'object', 
      properties: {} 
    },
    handler: async () => ({ 
      content: [{ 
        type: 'text', 
        text: 'Hello from MCP!' 
      }] 
    })
  });
  
  return <div>Tool is active!</div>;
}
```

### Pattern 2: Manual Initialization

Initialize the worker client manually before React mounts, then use hooks directly:

```tsx
// main.tsx
import { workerClient } from '@mcp-fe/mcp-worker';
import ReactDOM from 'react-dom/client';
import App from './App';

async function bootstrap() {
  // Initialize MCP Worker before React or inside the services layer
  await workerClient.init({
    backendWsUrl: 'ws://localhost:3001'
  });
  
  // Render React app
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}

bootstrap();
```

```tsx
// MyComponent.tsx
import { useMCPTool } from '@mcp-fe/react-tools';

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

## 🎯 Simple Examples

### Getter Tool (No Inputs)

Use `useMCPGetter` for simple data retrieval:

```tsx
import { useMCPGetter } from '@mcp-fe/react-tools';

function UserProfile() {
  const user = useUser();
  
  useMCPGetter(
    'get_user_profile',
    'Get current user profile',
    () => ({ 
      userId: user.id, 
      name: user.name,
      email: user.email 
    })
  );
  
  return <div>Welcome, {user.name}!</div>;
}
```

### Action Tool (With Inputs)

Use `useMCPAction` for tools that take parameters:

```tsx
import { useMCPAction } from '@mcp-fe/react-tools';

function TodoList() {
  const [todos, setTodos] = useState([]);
  
  useMCPAction(
    'add_todo',
    'Add a new todo item',
    {
      text: { 
        type: 'string', 
        description: 'The todo text' 
      }
    },
    async (args: { text: string }) => {
      const newTodo = { 
        id: Date.now(), 
        text: args.text,
        done: false
      };
      setTodos([...todos, newTodo]);
      return { 
        success: true, 
        todo: newTodo 
      };
    }
  );
  
  return (
    <div>
      <h2>Todos ({todos.length})</h2>
      {/* ... */}
    </div>
  );
}
```

## 🎓 Next Steps

- **[API Reference](./api-reference.md)** - Learn about all available hooks and options
- **[Guides](./guides.md)** - Explore advanced usage patterns
- **[Examples](./examples.md)** - See real-world implementation examples
