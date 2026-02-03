# @mcp-fe/react-tools

> React hooks and components for seamless integration with MCP (Model Context Protocol) tools.

Simplify dynamic MCP tool integration in React applications with automatic lifecycle management, reference counting, and full access to React features.

## ✨ Key Features

- 🔄 **Automatic Lifecycle** - Register on mount, unregister on unmount
- 📊 **Reference Counting** - Share tools across multiple components safely
- ⚡ **Re-render Safe** - Smart refs prevent duplicate registrations
- 🎯 **Full React Access** - Handlers have complete access to state, props, and context
- 🔌 **Optional Context** - Works standalone or with Provider
- 📘 **TypeScript First** - Complete type safety out of the box

## 📦 Installation

```bash
npm install @mcp-fe/react-tools
```

```bash
pnpm add @mcp-fe/react-tools
```

```bash
yarn add @mcp-fe/react-tools
```

## 🚀 Quick Example

```tsx
import { useMCPTool } from '@mcp-fe/react-tools';

function MyComponent() {
  const user = useUser();
  
  useMCPTool({
    name: 'get_user_profile',
    description: 'Get current user profile',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          userId: user.id,
          name: user.name,
          email: user.email
        })
      }]
    })
  });
  
  return <div>Profile tool is active!</div>;
}
```

## 📚 Documentation

**[📖 View Complete Documentation →](./docs/index.md)**

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Getting Started](./docs/getting-started.md)** - Installation, quick start, and basic usage
- **[API Reference](./docs/api-reference.md)** - Complete API documentation for all hooks and utilities
- **[Guides](./docs/guides.md)** - Advanced patterns and best practices
- **[Examples](./docs/examples.md)** - Real-world implementation examples
- **[Architecture](./docs/architecture.md)** - Internal design and data flow
- **[Troubleshooting](./docs/troubleshooting.md)** - Common issues and solutions


## 🎯 Core Hooks

### `useMCPTool`
The main hook for registering MCP tools with full lifecycle management.

### `useMCPGetter`
Simplified hook for getter tools (no input parameters).

### `useMCPAction`
Hook for action tools that accept inputs and perform operations.


[→ See full API documentation](./docs/api-reference.md)

## 🏗️ Project Links

- [📦 npm Package](https://www.npmjs.com/package/@mcp-fe/react-tools)
- [🐙 GitHub Repository](https://github.com/mcp-fe/mcp-fe)
- [🌐 Homepage](https://mcp-fe.ai)
- [📝 Changelog](../../CHANGELOG.md)

## 📄 License

Apache-2.0 - See [LICENSE](../../LICENSE) for details.

---

**Ready to get started?** Check out the [Getting Started Guide](./docs/getting-started.md)!
