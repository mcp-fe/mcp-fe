# MCP Worker Examples

This directory contains runnable examples demonstrating how to use the MCP Worker library for dynamic tool registration.

## 📁 Examples

### [quick-start.ts](./quick-start.ts)
Simple, ready-to-use examples perfect for getting started.

**Includes:**
- Basic tool without parameters
- Tool returning current user info
- Simple data getter
- Basic operation tool

**Best for:** First-time users, quick prototyping

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

await workerClient.init({ backendWsUrl: 'ws://localhost:3001' });

// Register a simple tool
await workerClient.registerTool(
  'get_time',
  'Get current time',
  { type: 'object', properties: {} },
  async () => ({
    content: [{ type: 'text', text: new Date().toISOString() }]
  })
);
```

### [dynamic-tools.ts](./dynamic-tools.ts)
Advanced patterns and real-world use cases.

**Includes:**
- Calculator with input validation
- HTTP requests (fetch API)
- Custom validation logic
- Error handling patterns
- Async operations

**Best for:** Production use cases, complex validation needs

```typescript
// Calculator with validation
await workerClient.registerTool(
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
    // Full validation and error handling
    // ...
  }
);
```

## 🚀 How to Use

### 1. Copy Example Code

All examples are designed to be copy-paste ready. Simply copy the functions you need into your application.

### 2. Adapt to Your Needs

Modify the examples to fit your specific use case:

```typescript
// Change the tool name and description
await workerClient.registerTool(
  'your_tool_name',        // ← Your tool name
  'Your tool description', // ← Your description
  {
    // Your input schema
  },
  async (args: any) => {
    // Your handler logic
  }
);
```

### 3. Run in Your Application

Make sure to initialize the worker client first:

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';

// Initialize
await workerClient.init({
  backendWsUrl: 'ws://localhost:3001' // Your MCP proxy URL
});

// Then register your tools
// ... (copy from examples)
```

## 📖 Related Documentation

- **[Guide](../docs/guide.md)** - Complete step-by-step guide
- **[Main README](../README.md)** - Library overview and API reference
- **[Architecture](../docs/architecture.md)** - How it works under the hood
- **[React Integration](../../react-event-tracker/REACT_MCP_TOOLS.md)** - React hooks guide

## 🎓 Learning Path

1. **Start here**: Read [quick-start.ts](./quick-start.ts)
2. **Then**: Try [dynamic-tools.ts](./dynamic-tools.ts) for advanced patterns
3. **Finally**: Check [Guide](../docs/guide.md) for complete reference

## 💡 Tips

### Import Pattern

These examples use direct imports for clarity:

```typescript
import { WorkerClient } from '@mcp-fe/mcp-worker';
const client = new WorkerClient();
```

In your app, use the singleton:

```typescript
import { workerClient } from '@mcp-fe/mcp-worker';
// Use workerClient directly (already instantiated)
```

### TypeScript Types

For better type safety, define your argument types:

```typescript
interface CalculateArgs {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
}

await workerClient.registerTool(
  'calculate',
  'Calculate',
  { /* schema */ },
  async (args: CalculateArgs) => { // ← Typed!
    const { operation, a, b } = args;
    // TypeScript will help you here
  }
);
```

### Error Handling

Always return proper error responses:

```typescript
async (args: any) => {
  try {
    // Your logic
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          // Include helpful context
        })
      }]
    };
  }
}
```

## 🔧 Running Examples

These examples are TypeScript files meant to be integrated into your application, not standalone scripts.

**To use them:**

1. Copy the code into your application
2. Import `workerClient` from `@mcp-fe/mcp-worker`
3. Call the functions where needed

**Example integration:**

```typescript
// In your app initialization
import { workerClient } from '@mcp-fe/mcp-worker';
import { registerSimpleTool, registerCalculatorTool } from './tools';

async function initializeApp() {
  await workerClient.init({ backendWsUrl: 'ws://localhost:3001' });
  
  // Register your tools
  await registerSimpleTool(workerClient);
  await registerCalculatorTool(workerClient);
  
  console.log('App initialized with MCP tools!');
}

initializeApp();
```

## 📝 Notes

- These examples are **reference implementations** - feel free to modify
- All examples use **proxy pattern** - handlers run in main thread
- Examples demonstrate **best practices** - follow the patterns shown
- For React, see [React examples](../../react-event-tracker/src/examples/)

## 🤝 Contributing

Have a useful example to share? Feel free to contribute!

See [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.
