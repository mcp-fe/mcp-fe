# React MCP Tools - Dokumentace

## 🎯 Přehled

React hooks pro snadnou integraci dynamických MCP toolů s automatickou správou lifecycle a reference counting.

### Klíčové vlastnosti:

- ✅ **Automatická registrace/odregistrace** - při mount/unmount
- ✅ **Reference counting** - stejný tool může být použit vícekrát
- ✅ **Re-render safe** - používá refs, neregistruje opakovaně
- ✅ **Plný přístup** - handler běží v main threadu (React state, props, context)
- ✅ **Volitelný Context** - funguje s i bez Provider
- ✅ **TypeScript** - plná type safety

## 🚀 Rychlý start

### Základní použití (bez Context)

```tsx
import { useMCPTool } from '@mcp-fe/react-event-tracker';

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
      // Plný přístup k React state/props/hooks!
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

### S Context Provider (doporučeno pro větší aplikace)

```tsx
import { MCPToolsProvider, useMCPTool } from '@mcp-fe/react-event-tracker';

// 1. Wrap app with Provider
function App() {
  return (
    <MCPToolsProvider backendWsUrl="ws://localhost:3001">
      <MyApp />
    </MCPToolsProvider>
  );
}

// 2. Use hooks v komponentách
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

Hlavní hook pro registraci MCP toolů.

**Options:**
```typescript
{
  name: string;                // Unikátní jméno toolu
  description: string;          // Popis pro AI
  inputSchema: object;          // JSON Schema pro vstupy
  handler: ToolHandler;         // Handler funkce (běží v main threadu!)
  autoRegister?: boolean;       // Auto-registrace při mount (default: true)
  autoUnregister?: boolean;     // Auto-odregistrace při unmount (default: true)
}
```

**Returns:**
```typescript
{
  isRegistered: boolean;        // Je tool zaregistrovaný?
  register: () => Promise<void>; // Manuální registrace
  unregister: () => Promise<void>; // Manuální odregistrace
  refCount: number;             // Počet komponent používajících tento tool
}
```

### Helper hooks

#### `useMCPGetter(name, description, getter)`

Pro jednoduché getter tooly (bez vstupů).

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

Pro action tooly (se vstupy).

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

Alias pro `useMCPAction` (sémanticky pro queries).

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

## 🔍 Pokročilé použití

### Reference Counting a Multiple Instances

Stejný tool může být použit vícekrát - automaticky se počítají reference:

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

// Component B - STEJNÝ tool!
function ComponentB() {
  const { refCount } = useMCPTool({
    name: 'shared_tool',  // <- stejné jméno
    description: 'Shared tool',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ content: [{ type: 'text', text: 'B' }] })
  });
  console.log('Ref count:', refCount); // 2
}

// Když se ComponentA unmountne, tool zůstane zaregistrovaný
// (protože ComponentB ho stále používá)

// Když se unmountne i ComponentB, tool se odregistruje
```

### Manuální kontrola registrace

```tsx
function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { register, unregister, isRegistered } = useMCPTool({
    name: 'admin_action',
    description: 'Admin-only action',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ content: [{ type: 'text', text: 'Done' }] }),
    autoRegister: false  // ← neregistrovat automaticky
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

### Handler s plným přístupem k React

Handler funkce běží v **main threadu**, takže má plný přístup:

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
      // ✅ Přístup k React state
      const newItem = {
        productId: args.productId,
        quantity: args.quantity,
        addedAt: Date.now()
      };
      setItems([...items, newItem]);
      
      // ✅ Přístup k React context
      console.log('Current user:', user.name);
      console.log('Theme:', theme.mode);
      
      // ✅ Přístup k localStorage
      localStorage.setItem('lastAdded', args.productId);
      
      // ✅ Přístup k DOM
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

### Persistent tools (neodregistrovat při unmount)

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
    autoUnregister: false  // ← zůstane i po unmount!
  });
}
```

### S Zod validací

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
      // Validace pomocí Zod
      const schema = z.object({
        username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
        email: z.string().email(),
        age: z.number().min(18).max(120)
      });
      
      try {
        const validated = schema.parse(args);
        
        // Vytvoření uživatele
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

## 🏗️ Architektura

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

Component B mounts (STEJNÝ tool!)
  ↓
useMCPTool('my_tool')
  ↓
toolRegistry.get('my_tool') === { refCount: 1 }
  ↓
Increment: toolRegistry.set('my_tool', { refCount: 2 })
  ↓
SKIP workerClient.registerTool() (už je zaregistrovaný)

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
handlerRef.current = newHandler  ← aktualizace ref
  ↓
stableHandler zůstává stabilní
  ↓
Na další CALL_TOOL se použije newHandler
```

Handler je automaticky aktualizován bez re-registrace!

## 🎨 Příklady use-cases

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

### Tool se registruje vícekrát

**Problém:** Handler se volá při každém re-renderu

**Řešení:** Hook automaticky používá refs - to by se nemělo stát. Zkontrolujte console pro `[useMCPTool]` logy.

### Handler nemá aktuální state

**Problém:** Handler používá starý state

**Řešení:** Hook automaticky aktualizuje handler ref. Ujistěte se, že používáte nejnovější verzi.

### Tool se neodregistruje

**Problém:** Tool zůstává i po unmount všech komponent

**Řešení:** Zkontrolujte `autoUnregister: true` (default). Nebo explicitně volejte `unregister()`.

### Context chyba

**Chyba:** `useMCPToolsContext must be used within MCPToolsProvider`

**Řešení:** Buď přidejte `<MCPToolsProvider>` nebo použijte `useMCPToolsContext(false)` (non-strict mode).

## 📝 Best Practices

1. **Pojmenování toolů:** Používejte snake_case (`get_user_profile`, ne `getUserProfile`)
2. **Descriptions:** Buďte konkrétní - AI používá popis k rozhodování
3. **Validation:** Vždy validujte vstupy (Zod, JSON Schema)
4. **Error handling:** Vracej užitečné error messages
5. **Reference counting:** Nechejte hook spravovat lifecycle automaticky
6. **Context:** Používejte Provider pro větší aplikace, není nutný pro malé

## 🚀 Migration z WorkerClient

**Před (manuální):**
```tsx
const client = new WorkerClient();
await client.init();
await client.registerTool(/* ... */);
// Manuální cleanup
useEffect(() => {
  return () => client.unregisterTool('my_tool');
}, []);
```

**Po (s hookem):**
```tsx
useMCPTool({
  name: 'my_tool',
  description: '...',
  inputSchema: {},
  handler: async () => ({ content: [{ type: 'text', text: 'OK' }] })
});
// Automatický cleanup! 🎉
```
