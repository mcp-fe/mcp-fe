# @mcp-fe/react

React hooks and components for seamless integration with MCP (Model Context Protocol) tools.

## 🎯 Features

- ✅ **Automatic registration/unregistration** - tools are registered on mount and unregistered on unmount
- ✅ **Reference counting** - same tool can be used by multiple components
- ✅ **Re-render safe** - uses refs, no duplicate registrations
- ✅ **Full React access** - handlers run in main thread with access to state, props, and context
- ✅ **Optional Context** - works with or without Provider
- ✅ **TypeScript** - full type safety

## 📦 Installation

```bash
npm install @mcp-fe/react
# or
pnpm add @mcp-fe/react
# or
yarn add @mcp-fe/react
```

## 🚀 Quick Start

```tsx
import { useMCPTool } from '@mcp-fe/react';

function MyComponent() {
  const user = useUser();
  
  useMCPTool({
    name: 'get_user_profile',
    description: 'Get current user profile',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ user })
        }]
      };
    }
  });
  
  return <div>Tool registered!</div>;
}
```

## 📚 Documentation

For complete documentation, see [REACT_MCP_TOOLS.md](./REACT_MCP_TOOLS.md).

## 🔗 Links

- [GitHub Repository](https://github.com/mcp-fe/mcp-fe)
- [Homepage](https://mcp-fe.ai)
- [Full Documentation](./REACT_MCP_TOOLS.md)

## 📄 License

Apache-2.0
