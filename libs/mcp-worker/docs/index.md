# Documentation Index

Complete guide to all documentation and examples in the MCP Worker library.

## 🎯 Quick Navigation

| I want to... | Go to... |
|--------------|----------|
| **Get started quickly** | [examples/quick-start.ts](../examples/quick-start.ts) |
| **See advanced patterns** | [examples/dynamic-tools.ts](../examples/dynamic-tools.ts) |
| **Learn step-by-step** | [Guide](./guide.md) |
| **Complete API reference** | [API Reference](./api.md) |
| **Worker implementation** | [Worker Details](./worker-details.md) |
| **Use with React** | [React Hooks Guide](../../react-event-tracker/REACT_MCP_TOOLS.md) |
| **Understand architecture** | [Architecture](./architecture.md) |
| **Handle initialization** | [Initialization](./initialization.md) |

## 📁 Documentation Structure

```
libs/mcp-worker/
├── README.md                              ← Start here!
│
├── docs/                                  ← Documentation
│   ├── index.md                           ← This file
│   ├── guide.md                           ← Complete guide
│   ├── api.md                             ← API reference
│   ├── worker-details.md                  ← Worker implementation
│   ├── architecture.md                    ← Technical architecture
│   └── initialization.md                  ← Init handling
│
├── examples/                              ← Code examples
│   ├── README.md                          ← Examples guide
│   ├── quick-start.ts                     ← Simple examples
│   └── dynamic-tools.ts                   ← Advanced patterns
│
└── src/                                   ← Source code
    └── lib/
        └── worker-client.ts

libs/react-event-tracker/
├── REACT_MCP_TOOLS.md                     ← React hooks docs
└── src/examples/
    └── ReactMCPToolsExamples.tsx          ← React examples
```

## 📖 Documentation by Purpose

### For Beginners

1. [README.md](../README.md) - Overview and quick start
2. [examples/quick-start.ts](../examples/quick-start.ts) - Simple examples
3. [examples/README.md](../examples/README.md) - How to use examples

### For Developers

1. [Guide](./guide.md) - Step-by-step guide
2. [API Reference](./api.md) - Complete API documentation
3. [examples/dynamic-tools.ts](../examples/dynamic-tools.ts) - Advanced patterns
4. [Worker Details](./worker-details.md) - Implementation details
5. [Architecture](./architecture.md) - How it works

### For React Users

1. [React Hooks Guide](../../react-event-tracker/REACT_MCP_TOOLS.md) - React integration
2. [React Examples](../../react-event-tracker/src/examples/ReactMCPToolsExamples.tsx) - Component examples

## 🔍 Finding What You Need

### "How do I register a tool?"
→ [examples/quick-start.ts](../examples/quick-start.ts) (Example 1)

### "How do I validate inputs?"
→ [examples/dynamic-tools.ts](../examples/dynamic-tools.ts) (Calculator example)

### "How do I use this with React?"
→ [React Hooks Guide](../../react-event-tracker/REACT_MCP_TOOLS.md)

### "How does the proxy pattern work?"
→ [Architecture](./architecture.md)

### "How do I handle initialization?"
→ [Initialization](./initialization.md)

## 📦 What's in the npm Package

When you install `@mcp-fe/mcp-worker`, you get:

```
node_modules/@mcp-fe/mcp-worker/
├── index.js                  # Main entry point
├── index.d.ts                # TypeScript definitions
├── mcp-shared-worker.js      # SharedWorker bundle
├── mcp-service-worker.js     # ServiceWorker bundle
├── lib/                      # Compiled library code
└── README.md                 # Basic documentation

# NOT included (development only):
# - examples/
# - docs/
# - src/
# - test files
```

**Note:** Examples and full documentation are in the [GitHub repository](https://github.com/mcp-fe/mcp-fe) but not in the npm package.

## 🤝 Contributing

See documentation issues? Want to improve examples?

1. Check [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines
2. Open an issue or PR
3. All documentation uses Markdown

---

**Last updated:** 2026-02-02
