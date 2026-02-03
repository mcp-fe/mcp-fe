# Getting Started

## 📦 Installation

Install the package using your preferred package manager:

```bash
npm install @mcp-fe/react-tools
```

```bash
pnpm add @mcp-fe/react-tools
```

```bash
yarn add @mcp-fe/react-tools
```

## 🚀 Quick Start

### Basic Usage (without Context)

The simplest way to use `@mcp-fe/react-tools` is directly in your components:

```tsx
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

### With Context Provider (Recommended for Larger Apps)

For better organization and centralized management, use the `MCPToolsProvider`:

```tsx
import { MCPToolsProvider, useMCPTool } from '@mcp-fe/react-tools';

// 1. Wrap your app with the Provider
function App() {
  return (
    <MCPToolsProvider backendWsUrl="ws://localhost:3001">
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
