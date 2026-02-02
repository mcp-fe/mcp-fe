# Dynamická registrace MCP toolů - Průvodce

## Jak to funguje

**Handler funkce běží v HLAVNÍM VLÁKNĚ (main thread)**, ne v worker kontextu!

To znamená, že máte **plný přístup** ke všemu:
- ✅ React context, hooks, Redux store
- ✅ DOM API, window, localStorage
- ✅ Všechny vaše importy a závislosti
- ✅ Closures a vnější proměnné

Worker pouze **přeposílá volání** mezi MCP protokolem a vaším handlerem.

```
MCP Client
    ↓ (calls tool via MCP protocol)
Worker (Shared/Service Worker)
    ↓ (proxies call via postMessage)
Main Thread - YOUR HANDLER 
    ↑ (returns result via postMessage)
Worker
    ↑ (returns result via MCP protocol)
MCP Client
```

## ✅ Jednoduché použití

### Základní příklad

```typescript
import { WorkerClient } from '@mcp-fe/mcp-worker';
import { z } from 'zod';

const client = new WorkerClient();
await client.init({ backendWsUrl: 'ws://localhost:3001' });

// ✅ Plný přístup k importům!
await client.registerTool(
  'validate_user',
  'Validate user data with Zod',
  {
    type: 'object',
    properties: {
      username: { type: 'string' },
      email: { type: 'string' }
    }
  },
  async (args: any) => {
    const schema = z.object({
      username: z.string().min(3),
      email: z.string().email()
    });
    
    const validated = schema.parse(args);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, data: validated })
      }]
    };
  }
);
```

### S přístupem k React contextu

```typescript
import { useMyStore } from './store';

function MyComponent() {
  const store = useMyStore();
  const client = new WorkerClient();
  
  useEffect(() => {
    const registerTools = async () => {
      await client.init();
      
      // ✅ Můžete používat store, state, cokoliv!
      await client.registerTool(
        'get_user_profile',
        'Get current user profile',
        { type: 'object', properties: {} },
        async () => {
          const user = store.getState().user;
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                username: user.username,
                email: user.email
              })
            }]
          };
        }
      );
    };
    
    registerTools();
  }, []);
  
  return <div>Tools registered!</div>;
}
```

## Praktické příklady

### Příklad: Calculator (inline)

```typescript
await client.registerTool(
  'calculate',
  'Perform arithmetic operations',
  {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
      a: { type: 'number' },
      b: { type: 'number' }
    }
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
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Division by zero' }) }]
          };
        }
        result = a / b;
        break;
      default:
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid operation' }) }]
        };
    }
    
    return {
      content: [{ type: 'text', text: JSON.stringify({ result }) }]
    };
  }
);
```

### Příklad: Fetch API

```typescript
await client.registerTool(
  'fetch_github_user',
  'Get GitHub user info',
  {
    type: 'object',
    properties: {
      username: { type: 'string' }
    }
  },
  async (args: any) => {
    const { username } = args;
    
    try {
      const response = await fetch(`https://api.github.com/users/${username}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            name: data.name,
            bio: data.bio,
            repos: data.public_repos,
            followers: data.followers
          })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error.message })
        }]
      };
    }
  }
);
```

### Příklad: S validací pomocí Zod

```typescript
import { z } from 'zod';

await client.registerTool(
  'validate_user',
  'Validate user registration data',
  {
    type: 'object',
    properties: {
      username: { type: 'string' },
      email: { type: 'string' },
      age: { type: 'number' },
      password: { type: 'string' }
    }
  },
  async (args: unknown) => {
    const schema = z.object({
      username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
      email: z.string().email(),
      age: z.number().min(18).max(120),
      password: z.string().min(8)
    });

    try {
      const validated = schema.parse(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            user: validated
          })
        }]
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              errors: error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message
              }))
            })
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Validation failed'
          })
        }]
      };
    }
  }
);
```

### Příklad: S přístupem k localStorage

```typescript
await client.registerTool(
  'get_user_preferences',
  'Get user preferences from localStorage',
  { type: 'object', properties: {} },
  async () => {
    const theme = localStorage.getItem('theme') || 'light';
    const language = localStorage.getItem('language') || 'en';
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ theme, language })
      }]
    };
  }
);
```

### Příklad: S přístupem k DOM

```typescript
await client.registerTool(
  'get_page_info',
  'Get current page information',
  { type: 'object', properties: {} },
  async () => {
    const title = document.title;
    const url = window.location.href;
    const headingsCount = document.querySelectorAll('h1, h2, h3').length;
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ title, url, headingsCount })
      }]
    };
  }
);
```

## Co můžete používat

Handler běží v **main threadu**, takže máte přístup ke **všemu**:

### ✅ Plný přístup k:

- ✅ **DOM API** - `document`, `window`, `querySelector`, `addEventListener`
- ✅ **Storage** - `localStorage`, `sessionStorage`, `IndexedDB`
- ✅ **React** - hooks, context, Redux store, Zustand, atd.
- ✅ **Všechny importy** - `import { z } from 'zod'`, knihovny NPM
- ✅ **Closures** - vnější proměnné, kontext
- ✅ **Fetch API** - HTTP requesty
- ✅ **Web APIs** - `navigator`, `crypto`, `Notification`, atd.
- ✅ **Standardní JS** - `Date`, `Math`, `JSON`, `Array`, `Map`, `Set`

### Žádná omezení!

Na rozdíl od handleru, které běží ve workeru, **handler v main threadu nemá žádná omezení**.

Můžete dělat cokoliv, co byste normálně dělali v browseru.

## Doporučení

1. **Validujte vstupy** - používejte Zod nebo podobnou knihovnu
2. **Ošetřujte chyby** - vracejte užitečné error messages
3. **Testujte handlers** - handler je normální async funkce, lze testovat
4. **Používejte TypeScript** - pro type safety
5. **Dokumentujte tooly** - dobré popisy pomáhají AI modelu

## Testování handleru před registrací

```typescript
// Test handler function before registering
const myHandler = async (args: any) => {
  // your implementation
  return { content: [{ type: 'text', text: JSON.stringify(args) }] };
};

// Test it
const testResult = await myHandler({ test: 'data' });
console.log('Handler output:', testResult);

// If test passes, register it
await client.registerTool('my_tool', 'Description', schema, myHandler);
```
