# Structured Output Guide

## Overview

The MCP Worker library supports **structured output** through the `outputSchema` parameter. According to MCP specification, tools with `outputSchema` return **both text and structured versions** of the data, allowing AI models to work with parsed objects directly.

## Key Benefits

- ✅ **Better AI Understanding**: AI models receive parsed JSON objects in `structuredContent`
- ✅ **Type Safety**: Define clear schemas for tool outputs using Zod or JSON Schema
- ✅ **Backward Compatible**: Legacy tools without `outputSchema` continue to work
- ✅ **Flexible**: Supports simple and complex nested data structures
- ✅ **MCP Compliant**: Follows official MCP specification format

## How It Works (MCP Specification)

### Without outputSchema (Legacy Behavior)

When `outputSchema` is not defined, the tool returns only text content:

```typescript
useMCPTool({
  name: 'get_user',
  inputSchema: { /* ... */ },
  // NO outputSchema
  handler: async () => {
    const data = { name: 'John', email: 'john@example.com' };
    return {
      content: [{ type: 'text', text: JSON.stringify(data) }]
    };
  }
});
```

**Result sent to AI:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"name\":\"John\",\"email\":\"john@example.com\"}"
    }
  ]
}
```

### With outputSchema (Structured Output)

When `outputSchema` is defined, the handler returns JSON text, and MCPController **automatically adds** `structuredContent`:

```typescript
useMCPTool({
  name: 'get_user',
  inputSchema: { /* ... */ },
  outputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' }
    }
  },
  handler: async () => {
    const data = { name: 'John', email: 'john@example.com' };
    // Return as JSON text - MCPController will parse it
    return {
      content: [{ type: 'text', text: JSON.stringify(data) }]
    };
  }
});
```

**Result sent to AI (automatic):**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"name\":\"John\",\"email\":\"john@example.com\"}"
    }
  ],
  "structuredContent": {
    "name": "John",
    "email": "john@example.com"
  }
}
```

**Key point:** You return text, MCPController adds `structuredContent` automatically!

## Usage Examples

### Simple Structured Output with Zod

```typescript
import { useMCPTool } from '@mcp-fe/react-tools';
import { z } from 'zod';

function MyComponent() {
  // Define Zod schema
  const productOutputSchema = z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    inStock: z.boolean(),
  });

  useMCPTool({
    name: 'get_product',
    description: 'Get product information',
    inputSchema: z.object({
      productId: z.string(),
    }).toJSONSchema(),
    outputSchema: productOutputSchema.toJSONSchema(),
    handler: async (args) => {
      const { productId } = args as { productId: string };
      
      // Fetch product data
      const product = await fetchProduct(productId);
      
      // Return as JSON text
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(product)
        }]
      };
    }
  });
}
```

**AI receives:**
```json
{
  "content": [{ "type": "text", "text": "{\"id\":\"123\",\"name\":\"Laptop\"...}" }],
  "structuredContent": {
    "id": "123",
    "name": "Laptop Pro",
    "price": 1299.99,
    "inStock": true
  }
}
```

### Complex Nested Output

```typescript
import { z } from 'zod';

const analyticsOutputSchema = z.object({
  period: z.string(),
  summary: z.object({
    totalVisits: z.number(),
    uniqueVisitors: z.number(),
  }),
  topPages: z.array(z.object({
    path: z.string(),
    views: z.number(),
  })),
});

useMCPTool({
  name: 'get_analytics',
  description: 'Get website analytics',
  inputSchema: z.object({
    period: z.enum(['day', 'week', 'month']),
  }).toJSONSchema(),
  outputSchema: analyticsOutputSchema.toJSONSchema(),
  handler: async (args) => {
    const analytics = await getAnalytics(args);
    
    // Return as JSON text
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(analytics)
      }]
    };
  }
});
```

### Array Output

```typescript
const usersOutputSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
}));

useMCPTool({
  name: 'search_users',
  description: 'Search for users',
  inputSchema: z.object({
    query: z.string(),
  }).toJSONSchema(),
  outputSchema: usersOutputSchema.toJSONSchema(),
  handler: async (args) => {
    const users = await searchUsers(args);
    
    // Return array as JSON text
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(users)
      }]
    };
  }
});
```

## Using with WorkerClient

The same functionality works with direct `WorkerClient` usage:

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

await workerClient.registerTool(
  'get_user',
  'Get user information',
  {
    type: 'object',
    properties: {
      userId: { type: 'string' }
    }
  },
  async (args) => {
    const user = await fetchUser(args.userId);
    
    // Return as JSON text
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(user)
      }]
    };
  },
  {
    // Define outputSchema in options
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  }
);
```

## Best Practices

### 1. Use Zod for Type-Safe Schemas

Zod provides better type inference and easier schema definition:

```typescript
import { z } from 'zod';

const outputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
});

// Use in tool
outputSchema: outputSchema.toJSONSchema()
```

### 2. Mark Optional Fields

Use `.optional()` for fields that may not be present:

```typescript
const schema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string(),  // Required
});
```

### 3. Always Return JSON Text

When using `outputSchema`, always return `type: 'text'` with JSON string:

```typescript
// ✅ Correct
return {
  content: [{
    type: 'text',
    text: JSON.stringify(yourData)
  }]
};

// ❌ Incorrect - not JSON
return {
  content: [{
    type: 'text',
    text: 'Some plain text'
  }]
};
```

### 4. Handle Errors Gracefully

```typescript
handler: async (args) => {
  try {
    const data = await fetchData(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data)
      }]
    };
  } catch (error) {
    // Errors are automatically handled by the framework
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
}
```

## Migration Guide

### Migrating Existing Tools

If you have existing tools without `outputSchema`, you can add it while keeping the same handler:

**Before (Legacy - no outputSchema):**
```typescript
useMCPTool({
  name: 'get_data',
  handler: async () => {
    const data = { value: 42 };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data)
      }]
    };
  }
});
// AI receives only text
```

**After (Structured - with outputSchema):**
```typescript
useMCPTool({
  name: 'get_data',
  outputSchema: z.object({
    value: z.number()
  }).toJSONSchema(),
  handler: async () => {
    const data = { value: 42 };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data)  // Same as before!
      }]
    };
  }
});
// AI receives text + structuredContent automatically
```

**Key point:** You don't need to change your handler! Just add `outputSchema` and MCPController does the rest.

## Implementation Details

### Internal Flow

1. **Tool Registration**: When a tool is registered with `outputSchema`, the flag is stored in `pendingToolCalls`
2. **Tool Execution**: Handler runs and returns JSON text in `content`
3. **Result Processing** (MCPController): 
   - If `hasOutputSchema` is true → Parse JSON from `content[0].text` and add as `structuredContent`
   - If `hasOutputSchema` is false → Return only `content` (legacy)
4. **AI Consumption**: AI model receives:
   - With `outputSchema`: `{ content: [...], structuredContent: {...} }`
   - Without `outputSchema`: `{ content: [...] }`

### Automatic Processing

```typescript
// Your handler returns:
{
  content: [{ type: 'text', text: '{"name":"John","age":30}' }]
}

// MCPController automatically adds (when outputSchema is present):
{
  content: [{ type: 'text', text: '{"name":"John","age":30}' }],
  structuredContent: { name: 'John', age: 30 }
}
```

### Type Definitions

```typescript
interface ToolCallResult {
  success: boolean;
  result?: {
    content: Array<{ type: string; text: string }>;
  };
  error?: string;
}
```

## Examples

See complete examples in:
- [`examples/structured-output.ts`](../examples/structured-output.ts) - WorkerClient examples
- [`react-tools/docs/examples.md`](../../react-tools/docs/examples.md#structured-output) - React hook examples

## Troubleshooting

### AI doesn't receive structuredContent

**Problem**: Tool has `outputSchema` but AI only receives text.

**Solution**: Verify your handler returns valid JSON:
```typescript
// ✅ Valid JSON string
return {
  content: [{
    type: 'text',
    text: JSON.stringify(yourData)  // Valid JSON
  }]
};

// ❌ Invalid - not JSON
return {
  content: [{
    type: 'text',
    text: 'Some plain text'  // Can't parse
  }]
};
```

### JSON parse error in MCPController

**Problem**: MCPController logs "Failed to parse structured content"

**Solution**: Ensure your data is JSON-serializable:
```typescript
// ✅ Serializable
const data = {
  name: 'John',
  date: new Date().toISOString(),  // String, not Date object
  value: 42
};

// ❌ Not serializable
const data = {
  name: 'John',
  date: new Date(),  // Date object fails JSON.stringify
  func: () => {}     // Functions fail
};
```

### TypeScript errors with handler return type

**Problem**: TypeScript complains about return type.

**Solution**: Handler type expects `{ content: Array<{ type: string; text: string }> }`:
```typescript
handler: async (): Promise<{ content: Array<{ type: string; text: string }> }> => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data)
    }]
  };
}
```

## See Also

- [Tool Registry Documentation](./api.md#tool-registry)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [JSON Schema Reference](https://json-schema.org/)
