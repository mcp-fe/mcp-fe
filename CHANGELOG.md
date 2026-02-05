## 0.1.6 (2026-02-05)

### 🚀 Features

- **MCP Tool Metadata Support**: Added full support for MCP tool metadata according to MCP specification
  - **Annotations**: AI hints for tool behavior (readOnly, destructive, idempotent, openWorld)
  - **Output Schema**: JSON Schema for tool outputs
  - **Execution Metadata**: Task support configuration
  - **Icons**: Visual representation with theme support (light/dark)
  - **Custom Metadata**: Extensible `_meta` field for application-specific data
  - **Display Title**: Optional human-readable title
  
### 📦 Updated Components

- `useMCPTool` hook: Extended `UseMCPToolOptions` with metadata fields
- `WorkerClient`: New `options` parameter in `registerTool()` method
- `MCPController`: Metadata parsing and registration
- `ToolRegistry`: Extended `ToolDefinition` with metadata properties
- Exported types: `Icon`, `ToolAnnotations`, `ToolExecution`

### 🔄 Backward Compatibility

- All changes are fully backward compatible
- `description` field is now optional (previously required)
- All metadata fields are optional
- Existing code works without modifications

### 📖 Documentation

- Updated [api-reference.md](./libs/react-tools/docs/api-reference.md) with metadata examples

### ❤️ Thank You

- Michal Kopecký

## 0.1.5 (2026-02-05)

### 🩹 Fixes

- Configure cjs build for react packages ([f931ab8](https://github.com/mcp-fe/mcp-fe/commit/f931ab8))
- Fixed deps for react-event-tracker ([3bfbc6d](https://github.com/mcp-fe/mcp-fe/commit/3bfbc6d))

### ❤️ Thank You

- Michal Kopecký

## 0.1.4 (2026-02-04)

### 🚀 Features

- **Multi-Tab Support**: Added comprehensive multi-tab support with intelligent routing
  - Each tab gets unique UUID (crypto.randomUUID()) stored in sessionStorage
  - **Smart routing**: If only one tab has a tool, automatically routes to it even if not active
  - **Navigation fallback**: When active tab loses tool (navigation), automatically routes to remaining tabs
  - **Automatic cleanup**: Tools unregister when page navigates/closes (beforeunload, pagehide events)
  - **TabManager class**: Standalone, testable class for tab management logic
  - Built-in `list_browser_tabs` meta-tool for tab discovery
  - Automatic `tabId` parameter added to all tool schemas
  - Tab reference counting for proper cleanup
  - Focus tracking with window.focus and document.visibilitychange

### 🎯 Routing Priority (Smart Strategy)
1. Explicit `tabId` parameter (always respected)
2. **Only one tab has tool → use it (even if not active)**
3. Active tab has tool → use it
4. **Active tab lacks tool (navigation) → use first available**
5. No active tab → use first available

### 🐛 Critical Fixes

- **Fixed MCPController recreation bug**: Multiple tabs no longer destroy shared controller
  - Worker now reuses existing controller when URL hasn't changed
  - Previously, each tab's INIT message recreated controller, losing all registered tabs
  - This was causing `list_browser_tabs` to return only the last initialized tab
  - Fixed in both SharedWorker and ServiceWorker implementations

### 🩹 Fixes

- **Fixed race condition in tab registration**: REGISTER_TAB now waits for INIT acknowledgment
  - Ensures controller is ready before tab registration
  - Prevents tabs from being lost during initialization

### 📖 Documentation

- Added comprehensive [Multi-Tab Guide](./libs/mcp-worker/docs/multi-tab.md)
- Updated [Architecture](./libs/mcp-worker/docs/architecture.md) with multi-tab section
- Updated [Guide](./libs/mcp-worker/docs/guide.md) with multi-tab usage

### ❤️ Thank You

- Michal Kopecký

## 0.1.3 (2026-02-04)

### 🩹 Fixes

- Setup mcp-worker as a peerDependency ([f9e52ca](https://github.com/mcp-fe/mcp-fe/commit/f9e52ca))

### ❤️ Thank You

- Michal Kopecký

## 0.1.2 (2026-02-04)

### 🩹 Fixes

- React-tools fixed external packages - do not include react ([efe3e36](https://github.com/mcp-fe/mcp-fe/commit/efe3e36))

### ❤️ Thank You

- Michal Kopecký

## 0.1.1 (2026-02-03)

### 🩹 Fixes

- fix release of react-tools ([d0aac3b](https://github.com/mcp-fe/mcp-fe/commit/d0aac3b))

### ❤️ Thank You

- Michal Kopecký

## 0.1.0 (2026-02-03)

### 🚀 Features

- introduction of dynamic MCP tools ([051b852](https://github.com/mcp-fe/mcp-fe/commit/051b852))

### ❤️ Thank You

- Michal Kopecký

## 0.0.17 (2026-02-02)

This was a version bump only, there were no code changes.

## 0.0.16 (2026-01-29)

This was a version bump only, there were no code changes.

## 0.0.15 (2026-01-29)

### 🩹 Fixes

- Support real JWT token format on server. Improved mock ([7eb8c41](https://github.com/mcp-fe/mcp-fe/commit/7eb8c41))

### ❤️ Thank You

- Michal Kopecký

## 0.0.14 (2026-01-25)

### 🩹 Fixes

- Update CodeQL action to v3 ([48ed307](https://github.com/mcp-fe/mcp-fe/commit/48ed307))
- Expose setAuthToken directly via useReactRouterEventTracker and useTanstackRouterEventTracker ([807e59a](https://github.com/mcp-fe/mcp-fe/commit/807e59a))

### ❤️ Thank You

- Michal Kopecký

## 0.0.13 (2026-01-23)

### 🩹 Fixes

- Specify peerDependencies for react-event-tracker ([9712178](https://github.com/mcp-fe/mcp-fe/commit/9712178))

### ❤️ Thank You

- Michal Kopecký

## 0.0.12 (2026-01-23)

This was a version bump only, there were no code changes.

## 0.0.11 (2026-01-23)

### 🩹 Fixes

- Reconfigure the mcp-worker publish to publish the worker files ([5562fed](https://github.com/mcp-fe/mcp-fe/commit/5562fed))
- Fixed types export for react-event-tracker ([274de1a](https://github.com/mcp-fe/mcp-fe/commit/274de1a))

### ❤️ Thank You

- Michal Kopecký

## 0.0.10 (2026-01-23)

### 🩹 Fixes

- Reconfigure the mcp-worker publish to publish the worker files ([5562fed](https://github.com/mcp-fe/mcp-fe/commit/5562fed))
- Fixed types export for react-event-tracker ([274de1a](https://github.com/mcp-fe/mcp-fe/commit/274de1a))

### ❤️ Thank You

- Michal Kopecký

## 0.0.9 (2026-01-23)

This was a version bump only, there were no code changes.

## 0.0.8 (2026-01-23)

This was a version bump only, there were no code changes.

## 0.0.7 (2026-01-23)

This was a version bump only, there were no code changes.

## 0.0.6 (2026-01-23)

This was a version bump only, there were no code changes.

## 0.0.5 (2026-01-23)

This was a version bump only, there were no code changes.

## 0.0.4 (2026-01-23)

This was a version bump only, there were no code changes.

## 0.0.3 (2026-01-22)

### 🩹 Fixes

- Configure deps ([f05bc81](https://github.com/kopecmi8/mcp-fe/commit/f05bc81))

### ❤️ Thank You

- Michal Kopecký

## 0.0.2 (2026-01-22)

This was a version bump only, there were no code changes.

## 0.0.1 (2026-01-22)

This was a version bump only, there were no code changes.
