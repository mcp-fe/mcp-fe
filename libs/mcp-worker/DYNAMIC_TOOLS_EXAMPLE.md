# Dynamická registrace MCP toolů

Tento průvodce vysvětluje, jak dynamicky registrovat vlastní MCP tooly z klientské aplikace bez nutnosti modifikovat worker kód.

## Přehled

MCP Worker nyní podporuje dynamickou registraci toolů přes WorkerClient API. Tooly jsou registrovány v centrálním registru (`toolRegistry`) uvnitř workeru a jsou automaticky dostupné přes MCP protokol.

## Základní použití

### 1. Inicializace WorkerClient

```typescript
import { WorkerClient } from '@mcp-fe/mcp-worker';

const workerClient = new WorkerClient();
await workerClient.init({
  backendWsUrl: 'ws://localhost:3001'
});
```

### 2. Registrace vlastního toolu

```typescript
// Definice vlastního toolu
await workerClient.registerTool(
  'get_user_profile',                    // název toolu
  'Get current user profile information', // popis
  {                                       // JSON Schema pro vstupy
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID to fetch'
      }
    },
    required: ['userId']
  },
  async (args: any) => {                 // handler funkce
    const { userId } = args;
    
    // Zde implementujete vaši logiku
    const userProfile = await fetchUserProfile(userId);
    
    // Musíte vrátit objekt v MCP formátu
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(userProfile, null, 2)
        }
      ]
    };
  }
);
```

### 3. Odregistrace toolu

```typescript
const wasRemoved = await workerClient.unregisterTool('get_user_profile');
console.log('Tool removed:', wasRemoved);
```

## Pokročilé příklady

### Příklad 1: Tool s validací pomocí Zod

```typescript
import { z } from 'zod';

await workerClient.registerTool(
  'search_products',
  'Search for products in the catalog',
  {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      category: {
        type: 'string',
        description: 'Product category filter',
        enum: ['electronics', 'clothing', 'food']
      },
      maxPrice: {
        type: 'number',
        description: 'Maximum price filter'
      }
    },
    required: ['query']
  },
  async (args: unknown) => {
    // Validace pomocí Zod
    const schema = z.object({
      query: z.string(),
      category: z.enum(['electronics', 'clothing', 'food']).optional(),
      maxPrice: z.number().optional()
    });
    
    const validated = schema.parse(args);
    
    // Vyhledání produktů
    const products = await searchProducts(validated);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query: validated.query,
            results: products,
            count: products.length
          }, null, 2)
        }
      ]
    };
  }
);
```

### Příklad 2: Tool s přístupem k API

```typescript
await workerClient.registerTool(
  'get_weather',
  'Get current weather for a location',
  {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'City name'
      },
      units: {
        type: 'string',
        description: 'Temperature units',
        enum: ['celsius', 'fahrenheit'],
        default: 'celsius'
      }
    },
    required: ['city']
  },
  async (args: any) => {
    const { city, units = 'celsius' } = args;
    
    try {
      const response = await fetch(
        `https://api.weather.example.com/current?city=${city}&units=${units}`
      );
      const weather = await response.json();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              city,
              temperature: weather.temp,
              conditions: weather.conditions,
              units
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to fetch weather data',
              message: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
          }
        ]
      };
    }
  }
);
```

### Příklad 3: Tool s přístupem k lokálním datům

```typescript
// Příklad s přístupem k React contextu nebo store
await workerClient.registerTool(
  'get_cart_items',
  'Get items in the shopping cart',
  {
    type: 'object',
    properties: {
      includeDetails: {
        type: 'boolean',
        description: 'Include detailed product information',
        default: false
      }
    }
  },
  async (args: any) => {
    const { includeDetails = false } = args;
    
    // Poznámka: Handler běží v kontextu workeru, takže nemá přímý
    // přístup k React contextu. Musíte použít jiný způsob komunikace.
    // Můžete například použít IndexedDB nebo poslat message zpět do hlavního vlákna.
    
    // Pro tento příklad předpokládáme, že data jsou v IndexedDB
    const db = await openDB('cart-db');
    const items = await db.getAll('cart-items');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            items: includeDetails 
              ? items 
              : items.map(item => ({ id: item.id, quantity: item.quantity })),
            totalCount: items.length
          }, null, 2)
        }
      ]
    };
  }
);
```

## Omezení a poznámky

### 1. Kontext vykonávání

Handler funkce běží v kontextu Service/Shared Workeru, **ne** v hlavním vlákně aplikace. To znamená:

- ❌ Nemáte přístup k DOM
- ❌ Nemáte přístup k React contextu, Redux store, atd.
- ❌ Nemáte přístup k `window`, `document`, `localStorage`
- ✅ Máte přístup k `fetch`, `IndexedDB`, `WebSocket`
- ✅ Můžete používat async/await
- ✅ Můžete importovat knihovny (pokud jsou dostupné v worker kontextu)

### 2. Serializace funkce

Handler funkce je serializována jako string a přenášena do workeru. To znamená:

- Funkce musí být samostatná (nesmí záviset na vnějším scope)
- Closures nebudou fungovat správně
- Nepoužívejte `this` kontext z vnějšího scope

**Špatně:**
```typescript
const apiKey = 'secret123';

// ❌ Toto nebude fungovat - apiKey není dostupný ve workeru
await workerClient.registerTool('bad_tool', '...', {}, async (args) => {
  const response = await fetch(`/api?key=${apiKey}`); // apiKey je undefined!
  // ...
});
```

**Správně:**
```typescript
// ✅ Předejte data jako parametr toolu
await workerClient.registerTool('good_tool', '...', {
  type: 'object',
  properties: {
    apiKey: { type: 'string' }
  }
}, async (args: any) => {
  const response = await fetch(`/api?key=${args.apiKey}`);
  // ...
});
```

### 3. Návratový formát

Handler **musí** vracet objekt ve formátu:

```typescript
{
  content: Array<{
    type: 'text',
    text: string
  }>
}
```

### 4. Chybové stavy

Doporučujeme zachytávat chyby a vracet je jako součást odpovědi:

```typescript
async (args: any) => {
  try {
    const result = await someOperation(args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error'
        }, null, 2)
      }]
    };
  }
}
```

## Architektura

```
┌─────────────────┐
│  Client App     │
│  (Main Thread)  │
│                 │
│  workerClient   │
│  .registerTool()│
└────────┬────────┘
         │ postMessage({ type: 'REGISTER_TOOL', ... })
         ▼
┌─────────────────┐
│ Shared/Service  │
│    Worker       │
│                 │
│  MCPController  │
│  ├─handleRegist │
│  │  erTool()    │
│  └─toolRegistry │
│     .register() │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MCP Server     │
│  (in worker)    │
│                 │
│  Responds to    │
│  ListTools &    │
│  CallTool       │
└─────────────────┘
```

## Testování

```typescript
// Test registrace
await workerClient.registerTool('test_tool', 'Test tool', {
  type: 'object',
  properties: {
    message: { type: 'string' }
  }
}, async (args: any) => {
  return {
    content: [{
      type: 'text',
      text: `Echo: ${args.message}`
    }]
  };
});

// Test odregistrace
const removed = await workerClient.unregisterTool('test_tool');
console.assert(removed === true, 'Tool should be removed');

// Test duplicitní registrace (přepíše předchozí)
await workerClient.registerTool('test_tool', 'New version', {...}, async (args) => {...});
```

## Tipy a best practices

1. **Pojmenování toolů**: Používejte snake_case pro názvy toolů (např. `get_user_profile`, ne `getUserProfile`)

2. **Popis toolu**: Buďte konkrétní - AI model používá popis k rozhodnutí, kdy tool použít

3. **Schema validace**: Vždy validujte vstupy (ideálně pomocí Zod nebo podobné knihovny)

4. **Error handling**: Vždy ošetřujte chyby a vracejte užitečné error messages

5. **Standalone funkce**: Ujistěte se, že handler funkce je samostatná a nepoužívá vnější kontext

6. **JSON serializable**: Všechny vstupy a výstupy musí být JSON serializovatelné

7. **Documentation**: Dokumentujte své tooly - přidejte dobré popisy do `description` a `inputSchema.properties.*.description`
