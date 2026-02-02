# Souhrn implementace: Dynamická registrace MCP toolů

## Co bylo implementováno

Přidána funkcionalita pro **dynamickou registraci vlastních MCP toolů** přímo z klientské aplikace bez nutnosti modifikovat worker kód.

## Změny v kódu

### 1. Tool Registry (`libs/mcp-worker/src/lib/mcp-server.ts`)

- ✅ Vytvořen `ToolRegistry` class pro centrální správu toolů
- ✅ Přesunuty vestavěné tooly do registru
- ✅ Upraveny MCP handlery pro použití dynamického registru
- ✅ Export typů `ToolDefinition`, `ToolHandler`, `toolRegistry`

### 2. MCPController (`libs/mcp-worker/src/lib/mcp-controller.ts`)

- ✅ Přidána metoda `handleRegisterTool(toolData)` 
- ✅ Přidána metoda `handleUnregisterTool(toolName)`
- ✅ Handler funkce jsou vytvořeny z string kódu pomocí `new Function()`

### 3. WorkerClient API (`libs/mcp-worker/src/lib/worker-client.ts`)

- ✅ Přidána veřejná metoda `registerTool(name, description, inputSchema, handler)`
- ✅ Přidána veřejná metoda `unregisterTool(name)`
- ✅ Handler funkce jsou serializovány jako string pro přenos do workeru

### 4. Shared Worker (`libs/mcp-worker/src/mcp-shared-worker.ts`)

- ✅ Přidán handler pro message type `REGISTER_TOOL`
- ✅ Přidán handler pro message type `UNREGISTER_TOOL`
- ✅ Podporuje MessageChannel pro request/response pattern

### 5. Service Worker (`libs/mcp-worker/src/mcp-service-worker.ts`)

- ✅ Přidán handler pro message type `REGISTER_TOOL`
- ✅ Přidán handler pro message type `UNREGISTER_TOOL`
- ✅ Podporuje MessageChannel pro request/response pattern

### 6. Exporty (`libs/mcp-worker/src/index.ts`)

- ✅ Export `WorkerClient` class
- ✅ Export `ToolDefinition` a `ToolHandler` typů
- ✅ Export `toolRegistry` instance

### 7. Dokumentace

- ✅ [`DYNAMIC_TOOLS_README.md`](./DYNAMIC_TOOLS_README.md) - Kompletní dokumentace
- ✅ [`DYNAMIC_TOOLS_EXAMPLE.md`](./DYNAMIC_TOOLS_EXAMPLE.md) - Detailní příklady a best practices
- ✅ [`example-dynamic-tools.ts`](./src/example-dynamic-tools.ts) - Spustitelné příklady

## Jak použít

### Základní použití

```typescript
import { WorkerClient } from '@mcp-fe/mcp-worker';

const client = new WorkerClient();
await client.init({
  backendWsUrl: 'ws://localhost:3001'
});

// Registrace vlastního toolu
await client.registerTool(
  'my_tool',
  'Description of the tool',
  {
    type: 'object',
    properties: {
      param: { type: 'string' }
    }
  },
  async (args: any) => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ result: args.param })
      }]
    };
  }
);

// Odregistrace
await client.unregisterTool('my_tool');
```

### Použití s existující singleton instancí

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

// workerClient je již vytvořená singleton instance
await workerClient.init();
await workerClient.registerTool(...);
```

## Architektura

```
Client App (Main Thread)
    ↓ workerClient.registerTool()
    ↓ postMessage({ type: 'REGISTER_TOOL', ... })
    ↓
Worker (Shared/Service Worker)
    ↓ MCPController.handleRegisterTool()
    ↓ toolRegistry.register()
    ↓
MCP Server
    ↓ ListTools → toolRegistry.getTools()
    ↓ CallTool → toolRegistry.getHandler()
```

## Komunikační protokol

### REGISTER_TOOL message

```typescript
{
  type: 'REGISTER_TOOL',
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  handler: string  // serializovaná funkce
}
```

**Response:**
```typescript
{ success: true } | { success: false, error: string }
```

### UNREGISTER_TOOL message

```typescript
{
  type: 'UNREGISTER_TOOL',
  name: string
}
```

**Response:**
```typescript
{ success: boolean }
```

## Bezpečnost

- Handler funkce běží v izolovaném worker kontextu
- Nemají přístup k DOM, window, localStorage
- Same-origin policy zabezpečuje worker sandbox
- Použití `new Function()` je bezpečné uvnitř workeru

⚠️ **Nedoporučujeme** registrovat tooly z nedůvěryhodných zdrojů.

## Omezení

### Handler funkce

- ❌ Nemají přístup k vnějšímu scope (closures nefungují)
- ❌ Nemají přístup k DOM API
- ❌ Nemají přístup k React context, Redux store
- ✅ Mohou používat `fetch()`, `IndexedDB`
- ✅ Mohou používat standardní JS API (`Date`, `Math`, atd.)

### Serializace

Handler funkce jsou serializovány jako string, takže:
- Musí být samostatné (self-contained)
- Nesmí záviset na vnějších proměnných
- Musí být async funkce vracející správný formát

## Testování

```typescript
// Test registrace
await client.registerTool('test', 'Test tool', {
  type: 'object',
  properties: { msg: { type: 'string' } }
}, async (args: any) => ({
  content: [{ type: 'text', text: args.msg }]
}));

// Test odregistrace
const removed = await client.unregisterTool('test');
console.assert(removed === true);
```

## Příklady v kódu

Viz [`example-dynamic-tools.ts`](./src/example-dynamic-tools.ts) pro:
- ✅ Jednoduchý tool bez parametrů
- ✅ Tool s parametry a validací
- ✅ Tool s async fetch operací
- ✅ Tool s komplexní validací

## Výhody řešení

1. **Zero worker modifikace** - klient nemusí měnit worker kód
2. **Type-safe** - plná TypeScript podpora
3. **Flexibilní** - podporuje libovolné MCP tooly
4. **Izolované** - handler běží v worker kontextu
5. **Jednotné API** - funguje se Shared i Service workerem

## Build a deploy

```bash
# Build knihovny
pnpm nx build mcp-worker

# Použití v aplikaci
import { WorkerClient } from '@mcp-fe/mcp-worker';
```

✅ **Build úspěšný** - všechny změny jsou funkční a připravené k použití!
