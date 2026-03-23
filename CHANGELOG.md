

## Unreleased

### 🐛 Fixes

- **ServiceWorker fallback broken after page reload** (`libs/mcp-worker`)
  - `initServiceWorkerFallback` returned early when an existing registration was found, skipping both the message listener setup and the `INIT` message to the worker. On every subsequent page load the worker never received `backendUrl` → never connected to the backend, and the client never received `CALL_TOOL` or `CONNECTION_STATUS`.
  - Fixed by merging the existing/new registration branches — the message listener and `INIT` are now always set up regardless of which path is taken.
  - Added `CONNECTION_STATUS` handling to the ServiceWorker message listener (mirroring the SharedWorker path) — `connectionStatusCallbacks` are now notified when using the ServiceWorker fallback.
  - For a freshly registered ServiceWorker (where `.active` is still `null`) `INIT` is now deferred until `navigator.serviceWorker.ready` resolves, preventing the message from being silently dropped.

- **`MCPToolsProvider` repeatedly re-running initialization** (`libs/react-tools`)
  - The `initialize` callback had unstable references (`initOptions`, `onInitialized`, `onInitError`) in its `useCallback` deps — these are typically inline objects/functions from the parent. Every parent re-render produced a new `initialize` instance, which re-triggered `useEffect([autoInit, initialize])` and logged `[MCPToolsProvider] Already initialized` on each cycle.
  - Fixed by moving those dependencies into refs (always-current ref pattern), giving `initialize` an empty dep array and making it stable for the lifetime of the component.
  - Replaced the `if (isInitialized)` stale-closure check with `if (workerClient.initialized)`, reading state directly from the singleton instead of a captured React state value.


### 🔐 Security

- **Strict JWT Verification**: The proxy server now cryptographically verifies JWT signatures instead of blindly decoding the `sub` claim.
  - Two modes via `AUTH_MODE` env variable:
    - `local` (default) — server issues and verifies its own HS256-signed tokens via `POST /auth/token`. `JWT_SECRET` must be set in production; server refuses to start without it when `NODE_ENV=production`.
    - `keycloak` — server validates tokens issued by Keycloak via JWKS (RS256/ES256). Required env vars: `KEYCLOAK_JWKS_URI`, `KEYCLOAK_ISSUER`, optionally `KEYCLOAK_AUDIENCE`.
  - The JWT secret never leaves the server in either mode.
  - Frontend (`mcp-fe`) now fetches its token from `POST /auth/token` instead of signing tokens client-side with a shared secret bundled in the JS bundle.

- **Secure Token Transport**: WebSocket authentication no longer passes `?token=...` in the URL (which leaked into server logs, proxy logs, and browser history).
  - Replaced with an initial payload handshake: client sends `{ "type": "AUTH", "token": "<jwt>" }` as the first WebSocket message after the connection is established.
  - Server replies `{ "type": "AUTH_OK" }` on success, or `{ "type": "AUTH_ERROR" }` + close code `4001` on failure.
  - Connections that do not complete the handshake within 10 seconds are automatically closed.

- **Session TTL**: Server-side sessions now expire after a configurable inactivity period.
  - Default changed from 5 minutes (hardcoded) to 30 minutes, configurable via `SESSION_TTL_MINUTES`.
  - Expired sessions actively close their WebSocket connection with code `1001 Going Away` and free all resources.
  - In Keycloak deployments, each token refresh triggers a WebSocket reconnect, automatically resetting the inactivity timer.

- **CORS configuration**: HTTP server now sets `Access-Control-Allow-*` headers for browser clients.
  - Configurable via `CORS_ORIGIN` (comma-separated origins or `*`). Defaults to `*` for local development.
  - Handles `OPTIONS` preflight requests.

### 🚀 Features

- New `POST /auth/token` endpoint (local mode only) for obtaining a server-signed JWT.
- New environment variables: `AUTH_MODE`, `JWT_SECRET`, `KEYCLOAK_JWKS_URI`, `KEYCLOAK_ISSUER`, `KEYCLOAK_AUDIENCE`, `SESSION_TTL_MINUTES`, `CORS_ORIGIN`.
- New build-time variable `MCP_SERVER_URL` for `mcp-fe` (default: `http://localhost:3001`).

### ✅ Testing

- Unit tests for `websocket-server.ts`: full auth handshake flow, timeout behaviour, message routing, and session cleanup (10 tests).

### ❤️ Thank You

- Michal Kopecký

---

## 0.2.0 (2026-02-22)

### 🚀 Features

- **WebMCP Support**: Native browser integration via [`navigator.modelContext`](https://webmachinelearning.github.io/webmcp/)
  - Tools registered with `registerTool()` are now automatically available to browser-native agents too
  - **Enabled by default** — auto-detects browser support, no configuration needed
  - One `registerTool()` call → two delivery channels (proxy + browser)
  - Opt-out via `enableWebMcp: false` or `setWebMcpEnabled(false)` at runtime

### 📦 New Files

- `web-mcp-types.ts` — TypeScript types matching the W3C WebMCP spec
- `web-mcp-adapter.ts` — `WebMcpAdapter` class bridging ToolRegistry ↔ `navigator.modelContext`

### 🔄 API Changes

- `WorkerClientInitOptions`: new `enableWebMcp` option (default: `true`)
- `WorkerClient`: new methods `isWebMcpSupported()`, `isWebMcpAvailable()`, `setWebMcpEnabled()`, `isToolRegisteredViaWebMcp()`, `getWebMcpRegisteredTools()`


### ❤️ Thank You

- Michal Kopecký

---

## 0.1.11 (2026-02-16)

### 🔄 Refactoring

- **ToolRegistry**: Extracted into separate class for better separation of concerns
  - New `ToolRegistry` class manages tool lifecycle (registration, ref counting, subscriptions)
  - `WorkerClient` delegates tool management to `ToolRegistry`
  - Simplified logic - tools register locally immediately, sync to worker after init
  - Removed pending registration queue - no longer needed

### 🐛 Fixes

- **useMCPTool**: Fixed double registration in React StrictMode
  - Added guard pattern with refs to prevent concurrent registrations
  - Tool now registers only once even with repeated effect calls
- **MCP Notifications**: Fixed missing tool list change notifications
  - MCPController now sends `notifications/tools/list_changed` when tools are added/removed
  - MCP clients will be properly notified about dynamic tool changes

### ✅ Testing

- **ToolRegistry**: Complete unit tests (32 tests)
  - All public methods covered including edge cases
  - Error handling in callback subscriptions

### ❤️ Thank You

- Michal Kopecký

---

## 0.1.10 (2026-02-15)

### 🩹 Fixes

- Fix the types path ([ae07146](https://github.com/mcp-fe/mcp-fe/commit/ae07146))

### ❤️ Thank You

- Michal Kopecký

## 0.1.9 (2026-02-15)

### 🚀 Features

- **MCP Tool Utilities**: New utility functions for accessing tool registry
  - **`getRegisteredTools()`**: Get list of all currently registered tool names
  - **`getToolInfo(name)`**: Get basic registration info (refCount, isRegistered)
  - **`getToolDetails(name)`**: Get complete ToolDefinition with all metadata
  - Exported from `@mcp-fe/react-tools` for easy access

### 🔄 Refactoring

- **Type Consolidation**: Unified tool type usage across codebase
  - `WorkerClient.toolRegistry` now uses `ToolDefinition` type instead of duplicating structure
  - `WorkerClient.getToolDetails()` returns `ToolDefinition & { refCount, isRegistered }`
  - Reduced code duplication and improved type safety

### 📦 Updated Components

- **WorkerClient**: Added `getToolDetails()` method for complete tool information
- **react-tools**: New exports for tool utilities in dedicated module


### ❤️ Thank You

- Michal Kopecký

---

## 0.1.8 (2026-02-14)

This was a version bump only, there were no code changes.

## 0.1.7 (2026-02-06)

### 🚀 Features

- **Structured Output Support**: Tools can now return structured data when `outputSchema` is defined  ([37d757c](https://github.com/mcp-fe/mcp-fe/commit/37d757c))
  - **Automatic Detection**: MCPController detects `outputSchema` presence and handles output accordingly
  - **Structured Data**: Tools with `outputSchema` return data as JSON objects instead of serialized text
  - **Legacy Support**: Tools without `outputSchema` continue to work with serialized text output
  - **Better AI Integration**: AI models can directly parse and manipulate structured outputs
  
### 📦 Updated Components

- `MCPController`: Added `hasOutputSchema` flag to `pendingToolCalls` for smart output handling
- `handleToolCallResult`: Conditional logic to return structured vs. serialized output
- `ToolHandler` type: Extended to support both text and resource content types
- `WorkerClient`: Updated handler types throughout for structured output compatibility

### 🎯 Use Cases

- **Type-Safe Outputs**: Define clear schemas for tool results
- **Complex Data**: Return nested objects and arrays without serialization
- **AI Understanding**: Models can better understand and work with structured data

### 📖 Documentation & Examples

- New [structured-output.md](./libs/mcp-worker/docs/structured-output.md) guide
- Example: [structured-output.ts](./libs/mcp-worker/examples/structured-output.ts) - WorkerClient usage
- Updated examples README with structured output section

### 🔄 Backward Compatibility

- **100% Backward Compatible**: All existing tools continue to work
- Tools without `outputSchema` maintain legacy serialized text behavior
- No breaking changes to existing APIs

---

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
