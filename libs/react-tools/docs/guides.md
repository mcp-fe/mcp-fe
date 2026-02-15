# Guides & Advanced Usage

Learn advanced patterns and techniques for using `@mcp-fe/react-tools` effectively.

## Reference Counting and Multiple Instances

The same tool can be registered by multiple components simultaneously. The library automatically manages reference counting to ensure tools remain registered as long as at least one component needs them.

### How It Works

```tsx
// Component A
function ComponentA() {
  const { refCount } = useMCPTool({
    name: 'shared_tool',
    description: 'A shared tool',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ content: [{ type: 'text', text: 'A' }] })
  });
  console.log('Ref count:', refCount); // 1
}

// Component B - SAME tool name!
function ComponentB() {
  const { refCount } = useMCPTool({
    name: 'shared_tool',  // ← Same name
    description: 'A shared tool',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ content: [{ type: 'text', text: 'B' }] })
  });
  console.log('Ref count:', refCount); // 2
}
```

**Lifecycle:**
1. When ComponentA mounts → tool registers, refCount = 1
2. When ComponentB mounts → refCount increments to 2 (no re-registration)
3. When ComponentA unmounts → refCount decrements to 1 (tool stays registered)
4. When ComponentB unmounts → refCount = 0, tool unregisters

---

## Manual Registration Control

For conditional tool registration, disable automatic registration:

```tsx
function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { register, unregister, isRegistered } = useMCPTool({
    name: 'admin_action',
    description: 'Admin-only action',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({ 
      content: [{ type: 'text', text: 'Admin action performed' }] 
    }),
    autoRegister: false  // ← Disable auto-registration
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
        Toggle Admin Mode
      </button>
      <p>Admin Tools: {isRegistered ? '🟢 Active' : '🔴 Inactive'}</p>
    </div>
  );
}
```

---

## Handler with Full React Access

Handlers run in the **main thread**, giving you complete access to React features:

```tsx
function ShoppingCart() {
  const [items, setItems] = useState([]);
  const user = useAuth();              // ✅ Context hooks
  const theme = useTheme();            // ✅ Context hooks
  const navigate = useNavigate();       // ✅ Router hooks
  
  useMCPAction(
    'add_to_cart',
    'Add item to shopping cart',
    {
      productId: { type: 'string' },
      quantity: { type: 'number' }
    },
    async (args: { productId: string; quantity: number }) => {
      // ✅ Access React state
      const newItem = {
        productId: args.productId,
        quantity: args.quantity,
        addedAt: Date.now()
      };
      setItems([...items, newItem]);
      
      // ✅ Access context values
      console.log('User:', user.name);
      console.log('Theme:', theme.mode);
      
      // ✅ Access browser APIs
      localStorage.setItem('lastAdded', args.productId);
      document.title = `Cart (${items.length + 1})`;
      
      // ✅ Navigation
      navigate('/cart');
      
      // ✅ Notifications
      toast.success('Item added to cart!');
      
      return {
        success: true,
        cartSize: items.length + 1,
        item: newItem
      };
    }
  );
}
```

---

## Persistent Tools

Create tools that persist even after the component unmounts:

```tsx
function GlobalSettings() {
  useMCPTool({
    name: 'get_app_version',
    description: 'Get application version',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          version: '1.0.0',
          buildDate: '2026-02-03'
        })
      }]
    }),
    autoUnregister: false  // ← Tool persists after unmount!
  });
  
  return <div>App version tool registered</div>;
}
```

**Use Cases:**
- Application-wide metadata tools
- System information tools
- Tools needed by AI throughout the session

---

## Validation with Zod

Add robust input validation using Zod:

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
      // Define validation schema
      const schema = z.object({
        username: z.string()
          .min(3, 'Username must be at least 3 characters')
          .max(20, 'Username must be at most 20 characters')
          .regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric and underscore allowed'),
        email: z.string()
          .email('Invalid email address'),
        age: z.number()
          .min(18, 'Must be at least 18 years old')
          .max(120, 'Invalid age')
      });
      
      try {
        // Validate input
        const validated = schema.parse(args);
        
        // Create user with validated data
        const user = await createUser(validated);
        
        return { 
          success: true, 
          user 
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Return validation errors
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

---

## Dynamic Handler Updates

Handlers automatically update with the latest state without re-registration:

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  
  // Handler always has the latest count value!
  useMCPGetter(
    'get_counter',
    'Get current counter value',
    () => ({ count })  // ← Always returns current count
  );
  
  useMCPAction(
    'increment_counter',
    'Increment the counter',
    { amount: { type: 'number', default: 1 } },
    async (args: { amount: number }) => {
      // Always works with latest state
      const newCount = count + args.amount;
      setCount(newCount);
      return { success: true, count: newCount };
    }
  );
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```


---

## Tool Monitoring

Monitor tool status in real-time:

```tsx
function ToolMonitor() {
  const { registeredTools } = useMCPToolsContext();
  const [toolStats, setToolStats] = useState<Record<string, any>>({});
  
  useEffect(() => {
    const stats = registeredTools.reduce((acc, name) => {
      const info = getToolInfo(name);
      if (info) {
        acc[name] = info;
      }
      return acc;
    }, {} as Record<string, any>);
    
    setToolStats(stats);
  }, [registeredTools]);
  
  return (
    <div>
      <h3>Active Tools: {registeredTools.length}</h3>
      <ul>
        {registeredTools.map(name => (
          <li key={name}>
            {name} - Refs: {toolStats[name]?.refCount || 0}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Error Handling

Implement comprehensive error handling:

```tsx
function DataFetcher() {
  useMCPAction(
    'fetch_data',
    'Fetch data from external API',
    {
      endpoint: { type: 'string' },
      method: { type: 'string', enum: ['GET', 'POST'] }
    },
    async (args: { endpoint: string; method: string }) => {
      try {
        const response = await fetch(`/api/${args.endpoint}`, {
          method: args.method
        });
        
        if (!response.ok) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: `HTTP ${response.status}: ${response.statusText}`
              })
            }],
            isError: true
          };
        }
        
        const data = await response.json();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(data)
          }]
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
}
```

---

## Best Practices

### 1. Clear Descriptions

Be specific - AI uses descriptions to understand tools:

```tsx
// ✅ Good
useMCPGetter(
  'get_user_preferences',
  'Get the current user\'s notification and privacy preferences',
  () => preferences
);

// ❌ Too vague
useMCPGetter(
  'get_preferences',
  'Get preferences',
  () => preferences
);
```

### 2. Input Validation

Always validate inputs:

```tsx
useMCPAction(
  'update_settings',
  'Update user settings',
  {
    theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
    fontSize: { type: 'number', minimum: 12, maximum: 24 }
  },
  async (args) => {
    // Inputs are pre-validated by JSON Schema
    // Additional validation if needed
    // ...
  }
);
```

### 3. Return Useful Data

Return structured, useful data:

```tsx
// ✅ Good
return {
  content: [{
    type: 'text',
    text: JSON.stringify({
      success: true,
      data: result,
      timestamp: Date.now()
    })
  }]
};

// ❌ Not helpful
return {
  content: [{
    type: 'text',
    text: 'ok'
  }]
};
```

---

## Next Steps

- **[Examples](./examples.md)** - See complete real-world examples
- **[Architecture](./architecture.md)** - Understand the internal design
- **[Troubleshooting](./troubleshooting.md)** - Solve common issues
