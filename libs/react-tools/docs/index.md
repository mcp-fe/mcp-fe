# @mcp-fe/react-tools - Documentation

Welcome to the **@mcp-fe/react-tools** documentation! This library provides React hooks and components for seamless integration with MCP (Model Context Protocol) tools.

## 📚 Documentation Contents

### 🚀 [Getting Started](./getting-started.md)
- Installation
- Quick Start Examples
- Basic Usage

### 📖 [API Reference](./api-reference.md)
- `useMCPTool` - Main hook for registering MCP tools
- `useMCPGetter` - Simple getter tools
- `useMCPAction` - Action tools with inputs
- `MCPToolsProvider` - Context provider
- `useMCPToolsContext` - Context hook
- Utility Functions

### 📘 [Guides & Advanced Usage](./guides.md)
- Reference Counting & Multiple Instances
- Manual Registration Control
- Handler with Full React Access
- Persistent Tools
- Validation with Zod

### 💡 [Examples](./examples.md)
- Todo List Manager
- Form Integration
- API Integration
- Shopping Cart
- More real-world examples

### 🏗️ [Architecture](./architecture.md)
- How It Works
- Reference Counting Flow
- Handler Update Flow
- Internal Design

### 🐛 [Troubleshooting](./troubleshooting.md)
- Common Issues
- Solutions & Best Practices
- Migration Guide

## 🎯 Key Features

- ✅ **Automatic registration/unregistration** - tools are registered on mount and unregistered on unmount
- ✅ **Reference counting** - same tool can be used by multiple components
- ✅ **Re-render safe** - uses refs, no duplicate registrations
- ✅ **Full React access** - handlers run in main thread with access to state, props, and context
- ✅ **Optional Context** - works with or without Provider
- ✅ **TypeScript** - full type safety

## 🔗 Quick Links

- [GitHub Repository](https://github.com/mcp-fe/mcp-fe)
- [Homepage](https://mcp-fe.ai)
- [npm Package](https://www.npmjs.com/package/@mcp-fe/react-tools)

## 📄 License

Apache-2.0
