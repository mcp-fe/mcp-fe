# Dynamická registrace MCP toolů

## Přehled

MCP Worker nyní podporuje **dynamickou registraci vlastních toolů** přímo z klientské aplikace. Nemusíte modifikovat kód workeru - stačí použít `WorkerClient` API.

## Rychlý start

```typescript
import { WorkerClient } from '@mcp-fe/mcp-worker';

// 1. Inicializace
const client = new WorkerClient();
await client.init({
  backendWsUrl: 'ws://localhost:3001'
});

// 2. Registrace vlastního toolu
await client.registerTool(
  'my_custom_tool',
  'Description of what this tool does',
  {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'First parameter' }
    },
    required: ['param1']
  },
  async (args: any) => {
    // Vaše implementace
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ result: args.param1 })
      }]
    };
  }
);

// 3. Tool je nyní dostupný přes MCP protokol!
```

## Jak to funguje

```
┌─────────────────────┐
│   Client App        │
│   (Main Thread)     │
│                     │
│  workerClient       │
│  .registerTool()    │
└──────────┬──────────┘
           │ 
           │ postMessage({ 
           │   type: 'REGISTER_TOOL',
           │   name, description,
           │   inputSchema, handler
           │ })
           │
           ▼
┌─────────────────────┐
│ Shared/Service      │
│ Worker              │
│                     │
│ MCPController       │
│  ├─ handleRegister  │
│  │   Tool()         │
│  └─ toolRegistry    │
│      .register()    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  MCP Server         │
│  (in worker)        │
│                     │
│  ListTools →        │
│   toolRegistry      │
│   .getTools()       │
│                     │
│  CallTool →         │
│   toolRegistry      │
│   .getHandler()     │
└─────────────────────┘
```

## API Reference

### `registerTool(name, description, inputSchema, handler)`

Zaregistruje nový MCP tool.

**Parametry:**
- `name` (string) - Unikátní název toolu (snake_case)
- `description` (string) - Popis pro AI model
- `inputSchema` (object) - JSON Schema pro validaci vstupů
- `handler` (async function) - Funkce která zpracovává volání toolu

**Handler signatura:**
```typescript
async (args: unknown) => Promise<{
  content: Array<{
    type: string;
    text: string;
  }>
}>
```

**Příklad:**
```typescript
await client.registerTool(
  'get_random_number',
  'Generate a random number in a range',
  {
    type: 'object',
    properties: {
      min: { type: 'number', default: 0 },
      max: { type: 'number', default: 100 }
    }
  },
  async (args: any) => {
    const { min = 0, max = 100 } = args;
    const random = Math.floor(Math.random() * (max - min + 1)) + min;
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ value: random, min, max })
      }]
    };
  }
);
```

### `unregisterTool(name)`

Odstraní dříve zaregistrovaný tool.

**Parametry:**
- `name` (string) - Název toolu k odstranění

**Vrací:**
- `Promise<boolean>` - `true` pokud byl tool nalezen a odstraněn

**Příklad:**
```typescript
const removed = await client.unregisterTool('get_random_number');
console.log('Removed:', removed); // true nebo false
```

## Omezení a best practices

### ⚠️ Důležitá omezení

1. **Handler běží v Worker kontextu** - nemáte přístup k DOM, `window`, `localStorage`, React contextu, atd.
   
2. **Handler je serializován jako string** - nepoužívejte closures nebo vnější proměnné
   
3. **Musíte vracet správný formát** - objekt s `content` array

### ✅ Můžete používat

- ✅ `fetch()` - HTTP requesty
- ✅ `IndexedDB` - lokální databáze
- ✅ `async/await`
- ✅ JSON operace
- ✅ `Date`, `Math`, standardní JS API

### ❌ Nemůžete používat

- ❌ `document`, `window`
- ❌ `localStorage`, `sessionStorage`
- ❌ React hooks, context
- ❌ DOM API
- ❌ Closures (vnější scope)

### 💡 Best practices

1. **Validujte vstupy:**
```typescript
async (args: any) => {
  if (!args.userId) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'userId is required' })
      }]
    };
  }
  // ...
}
```

2. **Ošetřujte chyby:**
```typescript
async (args: any) => {
  try {
    const result = await someOperation(args);
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
}
```

3. **Používejte snake_case pro názvy:**
```typescript
// ✅ Dobře
await client.registerTool('get_user_profile', ...)

// ❌ Špatně
await client.registerTool('getUserProfile', ...)
```

4. **Pište dobré popisy:**
```typescript
// ✅ Dobře - AI ví kdy použít
'Get detailed user profile including preferences and activity history'

// ❌ Špatně - příliš obecné
'Get user'
```

## Příklady

Více příkladů naleznete v:
- [`DYNAMIC_TOOLS_EXAMPLE.md`](./DYNAMIC_TOOLS_EXAMPLE.md) - Kompletní průvodce
- [`example-dynamic-tools.ts`](./src/example-dynamic-tools.ts) - Spustitelné příklady

## Vestavěné tooly

MCP Worker má 3 vestavěné tooly, které jsou vždy dostupné:

1. **`get_user_events`** - získá user activity události
2. **`get_navigation_history`** - navigační historie
3. **`get_click_events`** - klikací události

Tyto tooly nemůžete odregistrovat (jsou inicializovány při startu).

## Troubleshooting

### Tool se neobjevuje v MCP client

1. Zkontrolujte, že je worker inicializován: `await client.init()`
2. Ověřte, že registrace proběhla úspěšně (await dokončení)
3. Zkontrolujte konzoli pro chyby

### Handler nefunguje správně

1. Zkontrolujte, že vracíte správný formát (objekt s `content` array)
2. Ujistěte se, že handler nepoužívá vnější scope/closures
3. Otestujte handler samostatně před serializací

### TypeScript chyby

Pokud vidíte TypeScript chyby typu "Property 'handleRegisterTool' does not exist":
1. Restartujte TypeScript server v IDE
2. Zkuste `pnpm build` pro rebuild knihovny
3. Zkontrolujte verzi @mcp-fe/mcp-worker

## Implementační detaily

### Tool Registry

Centrální registr toolů v `mcp-server.ts`:

```typescript
class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private handlers = new Map<string, ToolHandler>();

  register(definition: ToolDefinition, handler: ToolHandler): void
  unregister(name: string): boolean
  getTools(): ToolDefinition[]
  getHandler(name: string): ToolHandler | undefined
}
```

### Komunikační flow

1. Client volá `workerClient.registerTool(...)`
2. WorkerClient serializuje handler funkci jako string
3. Pošle message `REGISTER_TOOL` do workeru
4. Worker (SharedWorker/ServiceWorker) přijme message
5. MCPController.handleRegisterTool() zpracuje request
6. Vytvoří novou funkci z handler stringu pomocí `new Function()`
7. Zaregistruje tool do toolRegistry
8. MCP Server automaticky vrací nový tool v `ListTools` response

### Bezpečnost

Handler funkce jsou vytvořeny pomocí `new Function()` uvnitř workeru. To je **bezpečné** protože:
- Worker běží v izolovaném kontextu
- Nemá přístup k citlivým datům hlavního vlákna
- Same-origin policy aplikuje sandbox

Nicméně **nedoporučujeme** registrovat tooly z nedůvěryhodných zdrojů.

## Licence

Apache 2.0 - viz [LICENSE](../../LICENSE)
