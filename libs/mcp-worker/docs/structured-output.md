# Structured Output Guide

## Overview

The MCP Worker library now supports **structured output** through the `outputSchema` parameter. This allows tools to return structured data that AI models can directly understand and manipulate, rather than serialized text strings.

## Key Benefits

- ✅ **Better AI Understanding**: AI models can directly parse and work with structured data
- ✅ **Type Safety**: Define clear schemas for tool outputs
- ✅ **Backward Compatible**: Legacy tools without `outputSchema` continue to work as before
- ✅ **Flexible**: Supports simple and complex nested data structures

## How It Works

### Without outputSchema (Legacy Behavior)

When `outputSchema` is not defined, the tool output is serialized to text:

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

When `outputSchema` is defined, the tool output is returned as structured data:

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
    return {
      content: [{ type: 'resource', resource: data }]
    };
  }
});
```

**Result sent to AI:**
```json
{
  "content": [
    {
      "type": "resource",
      "resource": {
        "name": "John",
        "email": "john@example.com"
      }
    }
  ]
}
```

## Usage Examples

### Simple Structured Output

```typescript
import { useMCPTool } from '@mcp-fe/react-tools';

function MyComponent() {
  useMCPTool({
    name: 'get_product',
    description: 'Get product information',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string' }
      },
      required: ['productId']
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' },
        inStock: { type: 'boolean' }
      },
      required: ['id', 'name', 'price', 'inStock']
    },
    handler: async (args) => {
      const { productId } = args as { productId: string };
      
      // Fetch product data
      const product = await fetchProduct(productId);
      
      // Return structured data
      return {
        content: [{
          type: 'resource',
          resource: product
        }]
      };
    }
  });
}
```

### Complex Nested Output

```typescript
useMCPTool({
  name: 'get_analytics',
  description: 'Get website analytics',
  inputSchema: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        enum: ['day', 'week', 'month']
      }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      period: { type: 'string' },
      summary: {
        type: 'object',
        properties: {
          totalVisits: { type: 'number' },
          uniqueVisitors: { type: 'number' }
        }
      },
      topPages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            views: { type: 'number' }
          }
        }
      }
    }
  },
  handler: async (args) => {
    const analytics = await getAnalytics(args);
    
    return {
      content: [{
        type: 'resource',
        resource: analytics
      }]
    };
  }
});
```

### Array Output

```typescript
useMCPTool({
  name: 'search_users',
  description: 'Search for users',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' }
    }
  },
  outputSchema: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  },
  handler: async (args) => {
    const users = await searchUsers(args);
    
    return {
      content: [{
        type: 'resource',
        resource: users
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
    return {
      content: [{
        type: 'resource',
        resource: user
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

### 1. Define Clear Schemas

Always define all required properties in your `outputSchema`:

```typescript
outputSchema: {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    createdAt: { type: 'string' }
  },
  required: ['id', 'name', 'email'] // Mark required fields
}
```

### 2. Use Appropriate Types

Choose the right JSON Schema types for your data:

```typescript
outputSchema: {
  type: 'object',
  properties: {
    count: { type: 'number' },           // Numbers
    active: { type: 'boolean' },          // Booleans
    tags: {                               // Arrays
      type: 'array',
      items: { type: 'string' }
    },
    metadata: {                           // Nested objects
      type: 'object',
      properties: {
        version: { type: 'string' }
      }
    }
  }
}
```

### 3. Return Consistent Structure

Always return data in the `resource` format when using `outputSchema`:

```typescript
// ✅ Correct
return {
  content: [{
    type: 'resource',
    resource: yourData
  }]
};

// ❌ Wrong - don't use 'text' with outputSchema
return {
  content: [{
    type: 'text',
    text: JSON.stringify(yourData)
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
        type: 'resource',
        resource: data
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

If you have existing tools without `outputSchema`, you can gradually migrate them:

**Before (Legacy):**
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
```

**After (Structured):**
```typescript
useMCPTool({
  name: 'get_data',
  outputSchema: {
    type: 'object',
    properties: {
      value: { type: 'number' }
    }
  },
  handler: async () => {
    const data = { value: 42 };
    return {
      content: [{
        type: 'resource',
        resource: data
      }]
    };
  }
});
```

## Implementation Details

### Internal Flow

1. **Tool Registration**: When a tool is registered with `outputSchema`, the flag is stored in `pendingToolCalls`
2. **Tool Execution**: Handler runs and returns data
3. **Result Processing**: 
   - If `hasOutputSchema` is true → Return as `resource` type
   - If `hasOutputSchema` is false → Serialize to text (legacy)
4. **AI Consumption**: AI model receives structured or text data accordingly

### Type Definitions

The internal types handle both formats:

```typescript
// Pending call with outputSchema flag
{
  resolve: (result: { content: Array<{ type: string; text: string }> }) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  hasOutputSchema: boolean;  // New field
}
```

## Examples

See complete examples in:
- [`examples/structured-output.ts`](../examples/structured-output.ts) - WorkerClient examples
- [`react-tools/docs/examples.md`](../../react-tools/docs/examples.md#structured-output) - React hook examples

## Troubleshooting

### Tool returns text instead of structured data

**Problem**: Tool has `outputSchema` but AI receives text.

**Solution**: Make sure handler returns data in `resource` format:
```typescript
return {
  content: [{
    type: 'resource',  // Use 'resource', not 'text'
    resource: yourData
  }]
};
```

### Type errors with resource

**Problem**: TypeScript complains about `resource` property.

**Solution**: The types are flexible - use type assertion if needed:
```typescript
return {
  content: [{
    type: 'resource',
    resource: yourData
  }]
} as { content: Array<{ type: string; text: string }> };
```

## See Also

- [Tool Registry Documentation](./api.md#tool-registry)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [JSON Schema Reference](https://json-schema.org/)
