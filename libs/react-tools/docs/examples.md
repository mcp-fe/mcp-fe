# Examples

Real-world examples demonstrating how to use `@mcp-fe/react-tools` in your applications.

## Todo List Manager

Complete todo list with multiple MCP tools:

```tsx
import { useMCPGetter, useMCPAction } from '@mcp-fe/react-tools';

interface Todo {
  id: number;
  text: string;
  done: boolean;
  createdAt: number;
}

function TodoManager() {
  const [todos, setTodos] = useState<Todo[]>([]);
  
  // List all todos
  useMCPGetter(
    'list_todos',
    'Get all todo items',
    () => todos
  );
  
  // Add new todo
  useMCPAction(
    'add_todo',
    'Add a new todo item',
    {
      text: { type: 'string', description: 'The todo text' }
    },
    async (args: { text: string }) => {
      const newTodo: Todo = {
        id: Date.now(),
        text: args.text,
        done: false,
        createdAt: Date.now()
      };
      setTodos([...todos, newTodo]);
      return { success: true, todo: newTodo };
    }
  );
  
  // Toggle todo completion
  useMCPAction(
    'toggle_todo',
    'Toggle a todo item\'s completion status',
    {
      id: { type: 'number', description: 'The todo ID' }
    },
    async (args: { id: number }) => {
      const todo = todos.find(t => t.id === args.id);
      if (!todo) {
        return { success: false, error: 'Todo not found' };
      }
      
      setTodos(todos.map(t => 
        t.id === args.id ? { ...t, done: !t.done } : t
      ));
      
      return { success: true, todo: { ...todo, done: !todo.done } };
    }
  );
  
  // Delete todo
  useMCPAction(
    'delete_todo',
    'Delete a todo item',
    {
      id: { type: 'number', description: 'The todo ID' }
    },
    async (args: { id: number }) => {
      const exists = todos.some(t => t.id === args.id);
      if (!exists) {
        return { success: false, error: 'Todo not found' };
      }
      
      setTodos(todos.filter(t => t.id !== args.id));
      return { success: true };
    }
  );
  
  // Get completed todos count
  useMCPGetter(
    'get_todos_stats',
    'Get statistics about todos',
    () => ({
      total: todos.length,
      completed: todos.filter(t => t.done).length,
      pending: todos.filter(t => !t.done).length
    })
  );
  
  return (
    <div>
      <h2>Todos ({todos.length})</h2>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => {
                setTodos(todos.map(t =>
                  t.id === todo.id ? { ...t, done: !t.done } : t
                ));
              }}
            />
            <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>
              {todo.text}
            </span>
            <button onClick={() => setTodos(todos.filter(t => t.id !== todo.id))}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Form Integration

Integrate MCP tools with React forms:

```tsx
import { useMCPGetter, useMCPAction } from '@mcp-fe/react-tools';

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

function ContactForm() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  
  // Get current form data
  useMCPGetter(
    'get_form_data',
    'Get current contact form data',
    () => formData
  );
  
  // Fill form fields
  useMCPAction(
    'fill_form',
    'Fill contact form with provided data',
    {
      name: { type: 'string' },
      email: { type: 'string' },
      message: { type: 'string' }
    },
    async (args: ContactFormData) => {
      setFormData(args);
      return { success: true, data: args };
    }
  );
  
  // Submit form
  useMCPAction(
    'submit_form',
    'Submit the contact form',
    {},
    async () => {
      if (!formData.name || !formData.email || !formData.message) {
        return { 
          success: false, 
          error: 'All fields are required' 
        };
      }
      
      try {
        await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        setSubmitted(true);
        setFormData({ name: '', email: '', message: '' });
        
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: 'Failed to submit form' 
        };
      }
    }
  );
  
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <input
        type="text"
        placeholder="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <textarea
        placeholder="Message"
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
      />
      <button type="submit">Send</button>
      {submitted && <p>Thank you! Message sent.</p>}
    </form>
  );
}
```

---

## API Integration

Interact with external APIs using MCP tools:

```tsx
import { useMCPAction } from '@mcp-fe/react-tools';

function DataFetcher() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useMCPAction(
    'fetch_data',
    'Fetch data from an API endpoint',
    {
      endpoint: { 
        type: 'string', 
        description: 'API endpoint path' 
      },
      params: { 
        type: 'object', 
        description: 'Query parameters',
        default: {}
      }
    },
    async (args: { endpoint: string; params: Record<string, any> }) => {
      setLoading(true);
      setError(null);
      
      try {
        const queryString = new URLSearchParams(args.params).toString();
        const url = `/api/${args.endpoint}${queryString ? '?' + queryString : ''}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setData(data);
        
        return { 
          success: true, 
          data 
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        
        return { 
          success: false, 
          error: errorMessage 
        };
      } finally {
        setLoading(false);
      }
    }
  );
  
  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

---

## Shopping Cart

E-commerce shopping cart with MCP tools:

```tsx
import { useMCPGetter, useMCPAction } from '@mcp-fe/react-tools';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

function ShoppingCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const user = useAuth();
  
  // Get cart contents
  useMCPGetter(
    'get_cart',
    'Get shopping cart contents',
    () => ({
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
    })
  );
  
  // Add to cart
  useMCPAction(
    'add_to_cart',
    'Add an item to the shopping cart',
    {
      productId: { type: 'string' },
      name: { type: 'string' },
      price: { type: 'number' },
      quantity: { type: 'number', default: 1 }
    },
    async (args: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      const existingItem = items.find(i => i.productId === args.productId);
      
      if (existingItem) {
        // Update quantity
        setItems(items.map(i =>
          i.productId === args.productId
            ? { ...i, quantity: i.quantity + (args.quantity || 1) }
            : i
        ));
      } else {
        // Add new item
        setItems([...items, { 
          ...args, 
          quantity: args.quantity || 1 
        }]);
      }
      
      // Save to localStorage
      localStorage.setItem(`cart_${user.id}`, JSON.stringify(items));
      
      return { success: true };
    }
  );
  
  // Remove from cart
  useMCPAction(
    'remove_from_cart',
    'Remove an item from the cart',
    {
      productId: { type: 'string' }
    },
    async (args: { productId: string }) => {
      setItems(items.filter(i => i.productId !== args.productId));
      return { success: true };
    }
  );
  
  // Update quantity
  useMCPAction(
    'update_cart_quantity',
    'Update item quantity in cart',
    {
      productId: { type: 'string' },
      quantity: { type: 'number', minimum: 0 }
    },
    async (args: { productId: string; quantity: number }) => {
      if (args.quantity === 0) {
        setItems(items.filter(i => i.productId !== args.productId));
      } else {
        setItems(items.map(i =>
          i.productId === args.productId
            ? { ...i, quantity: args.quantity }
            : i
        ));
      }
      return { success: true };
    }
  );
  
  // Checkout
  useMCPAction(
    'checkout',
    'Process checkout for cart items',
    {},
    async () => {
      if (items.length === 0) {
        return { success: false, error: 'Cart is empty' };
      }
      
      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, userId: user.id })
        });
        
        const result = await response.json();
        
        if (result.success) {
          setItems([]);
          localStorage.removeItem(`cart_${user.id}`);
        }
        
        return result;
      } catch (error) {
        return { 
          success: false, 
          error: 'Checkout failed' 
        };
      }
    }
  );
  
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  return (
    <div>
      <h2>Shopping Cart</h2>
      {items.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <>
          <ul>
            {items.map(item => (
              <li key={item.productId}>
                {item.name} - ${item.price} × {item.quantity}
                <button onClick={() => 
                  setItems(items.filter(i => i.productId !== item.productId))
                }>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p>Total: ${total.toFixed(2)}</p>
          <button onClick={async () => {
            const response = await fetch('/api/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items, userId: user.id })
            });
            if (response.ok) {
              setItems([]);
            }
          }}>
            Checkout
          </button>
        </>
      )}
    </div>
  );
}
```

---

## Settings Manager

Application settings with persistence:

```tsx
import { useMCPGetter, useMCPAction } from '@mcp-fe/react-tools';

interface Settings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  notifications: boolean;
  language: string;
}

function SettingsManager() {
  const [settings, setSettings] = useState<Settings>({
    theme: 'auto',
    fontSize: 16,
    notifications: true,
    language: 'en'
  });
  
  // Get current settings
  useMCPGetter(
    'get_settings',
    'Get current application settings',
    () => settings
  );
  
  // Update settings
  useMCPAction(
    'update_settings',
    'Update application settings',
    {
      theme: { 
        type: 'string', 
        enum: ['light', 'dark', 'auto'] 
      },
      fontSize: { 
        type: 'number', 
        minimum: 12, 
        maximum: 24 
      },
      notifications: { type: 'boolean' },
      language: { 
        type: 'string',
        enum: ['en', 'es', 'fr', 'de', 'cs']
      }
    },
    async (args: Partial<Settings>) => {
      const newSettings = { ...settings, ...args };
      setSettings(newSettings);
      localStorage.setItem('settings', JSON.stringify(newSettings));
      
      return { success: true, settings: newSettings };
    }
  );
  
  // Reset to defaults
  useMCPAction(
    'reset_settings',
    'Reset all settings to default values',
    {},
    async () => {
      const defaults: Settings = {
        theme: 'auto',
        fontSize: 16,
        notifications: true,
        language: 'en'
      };
      setSettings(defaults);
      localStorage.setItem('settings', JSON.stringify(defaults));
      
      return { success: true, settings: defaults };
    }
  );
  
  return (
    <div>
      <h2>Settings</h2>
      <label>
        Theme:
        <select 
          value={settings.theme}
          onChange={(e) => setSettings({ 
            ...settings, 
            theme: e.target.value as Settings['theme']
          })}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto</option>
        </select>
      </label>
      {/* More settings UI... */}
    </div>
  );
}
```

---

## Next Steps

- **[Architecture](./architecture.md)** - Understand how it works
- **[Troubleshooting](./troubleshooting.md)** - Solve common issues
- **[API Reference](./api-reference.md)** - Detailed API documentation
