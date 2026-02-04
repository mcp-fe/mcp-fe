# Multi-Tab Support

Comprehensive guide to multi-tab architecture and usage patterns.

## Overview

The MCP Worker library provides seamless multi-tab support with intelligent routing. Each browser tab can register tools independently, and the worker automatically routes tool calls to the appropriate tab.

## Architecture

### Tab Lifecycle

```
1. Tab Opens
   └─> Generate UUID (crypto.randomUUID())
   └─> Store in sessionStorage
   └─> Register with worker (REGISTER_TAB)
   └─> Mark as active (SET_ACTIVE_TAB)

2. Tab Focus
   └─> Update active tab (SET_ACTIVE_TAB)

3. Tab Closes
   └─> Tools remain available if other tabs have them
   └─> Reference counting prevents premature unregistration
```

### Tab Registry

The worker maintains a registry of all active tabs:

```typescript
{
  tabId: string;        // UUID from crypto.randomUUID()
  url: string;          // window.location.href
  title: string;        // document.title
  lastSeen: number;     // timestamp of last activity
}
```

### Tool Registry Per Tab

Tools are tracked per-tab using Sets:

```typescript
Map<ToolName, Set<TabId>>

Example:
{
  "get_page_info": Set(["tab-abc", "tab-def"]),
  "get_user_data": Set(["tab-abc"]),
}
```

## Routing Strategies

### 1. Smart Routing (Default)

Intelligent routing that prioritizes user intent and availability:

```typescript
// Priority order:
1. Explicit tabId parameter (always respected)
2. Only one tab has tool → route to it (regardless of focus)
3. Active/focused tab has tool → use it
4. Active tab doesn't have tool → use first available
5. No active tab → use first available
```

**Example Scenarios:**

**Scenario 1: Single tab with tool (most intuitive)**
```typescript
// Tab A (active): Has toolX
// Tab B (inactive): Doesn't have toolX

toolX()
→ Routes to Tab A ✓ (active tab has it)

// Now focus Tab B
// Tab A (inactive): Has toolX
// Tab B (active): Doesn't have toolX

toolX()
→ Routes to Tab A ✓ (only tab with tool, even though not active!)
```

**Scenario 2: Multiple tabs with tool**
```typescript
// Tab A (active): Has toolX
// Tab B (inactive): Has toolX

toolX()
→ Routes to Tab A ✓ (active tab preferred when multiple available)

// Now focus Tab B
// Tab A (inactive): Has toolX
// Tab B (active): Has toolX

toolX()
→ Routes to Tab B ✓ (new active tab)
```

**Scenario 3: Explicit targeting**
```typescript
// Tab A (active): Has toolX
// Tab B (inactive): Has toolX

toolX({ tabId: "tab-b-id" })
→ Routes to Tab B ✓ (explicit parameter always wins)
```

**Scenario 4: Active tab loses tool (navigation)**
```typescript
// Initial state
// Tab A (active): Has toolX
// Tab B (inactive): Has toolX

toolX()
→ Routes to Tab A ✓ (active tab)

// User navigates Tab A to different page
// Tab A (active): No longer has toolX (page changed)
// Tab B (inactive): Has toolX

toolX()
→ Routes to Tab B ✓ (active tab doesn't have tool, auto-fallback!)
// No error, seamless transition
```

**Visual Flow:**
```
Before Navigation:
┌─────────────┐         ┌─────────────┐
│  Tab A      │ Active  │  Tab B      │
│  /dashboard │   ✓     │  /dashboard │
│  has toolX  │         │  has toolX  │
└─────────────┘         └─────────────┘
       ↑
   toolX() routes here

After Navigation (Tab A → /settings):
┌─────────────┐         ┌─────────────┐
│  Tab A      │ Active  │  Tab B      │
│  /settings  │   ✓     │  /dashboard │
│  NO toolX   │         │  has toolX  │
└─────────────┘         └─────────────┘
                              ↑
                    toolX() auto-routes here!
```

This ensures tools continue to work even when the user navigates away from pages that provided specific tools.

### 2. Built-in Discovery Tool

`list_browser_tabs` provides tab discovery:

```typescript
// Always returns current tab state
const tabs = await list_browser_tabs();

[
  {
    tabId: "550e8400-e29b-41d4-a716-446655440000",
    url: "https://app.example.com/dashboard",
    title: "Dashboard - My App",
    isActive: true,
    lastSeen: "2026-02-04T10:30:00.000Z"
  },
  {
    tabId: "6fa459ea-ee8a-3ca4-894e-db77e160355e",
    url: "https://app.example.com/settings",
    title: "Settings - My App",
    isActive: false,
    lastSeen: "2026-02-04T10:29:45.000Z"
  }
]
```

## Tool Schema Enhancement

All registered tools automatically receive an optional `tabId` parameter:

**Original Schema:**
```json
{
  "type": "object",
  "properties": {
    "username": { "type": "string" }
  }
}
```

**Enhanced Schema:**
```json
{
  "type": "object",
  "properties": {
    "username": { "type": "string" },
    "tabId": {
      "type": "string",
      "description": "Optional: Target specific tab by ID. If not provided, uses the currently focused tab. Use list_browser_tabs to discover available tabs."
    }
  }
}
```

The `tabId` parameter is automatically added by the library - you don't need to include it in your schema.

## Use Cases

### 1. Debugging Specific Tab

AI can debug a specific tab while user works in another:

```
User: "Check the state of the Settings tab"

AI:
1. list_browser_tabs()
   → Finds Settings tab ID: "6fa459ea..."

2. get_react_state({ tabId: "6fa459ea..." })
   → Gets state from Settings tab

3. analyze_component({ tabId: "6fa459ea...", component: "UserForm" })
   → Analyzes specific component
```

### 2. Cross-Tab Comparison

Compare state/data across multiple tabs:

```typescript
const tabs = await list_browser_tabs();

const states = await Promise.all(
  tabs.map(tab => 
    get_react_state({ tabId: tab.tabId })
  )
);

// Compare states across tabs
```

### 3. Focus-Driven Interaction

Natural interaction with focused tab:

```
User: "What's on this page?"
AI: get_page_info()  // No tabId needed
→ Automatically uses focused tab
```

### 4. Multi-Screen Workflows

User has multiple monitors with different tabs:

```
Monitor 1: Dashboard (focused)
Monitor 2: Analytics
Monitor 3: Settings

// AI can work with any tab
get_metrics({ tabId: "analytics-tab" })      // Monitor 2
update_settings({ tabId: "settings-tab" })   // Monitor 3
show_alert()                                  // Monitor 1 (focused)
```

## Reference Counting

Tools use reference counting to handle multiple registrations:

```typescript
// Tab 1 registers tool
workerClient.registerTool('get_data', ...)
// → Registered with MCP, refCount = 1

// Tab 2 registers same tool
workerClient.registerTool('get_data', ...)
// → NOT re-registered with MCP, refCount = 2

// Tab 1 closes/unregisters
workerClient.unregisterTool('get_data')
// → NOT unregistered from MCP, refCount = 1

// Tab 2 closes/unregisters
workerClient.unregisterTool('get_data')
// → Unregistered from MCP, refCount = 0
```

## Tab Persistence

### SessionStorage Persistence

Tab IDs are stored in `sessionStorage`, which means:

- ✅ **Page refresh (F5)**: Tab keeps same ID
- ✅ **Navigation**: Tab keeps same ID
- ❌ **Duplicate tab**: New tab gets new ID
- ❌ **New window**: New window gets new ID
- ❌ **Private/Incognito**: Each session independent

### Tab ID Format

```typescript
// UUID v4 from crypto.randomUUID()
"550e8400-e29b-41d4-a716-446655440000"

// Fallback if crypto unavailable
"fallback_1738668000000_xyz123"
```

## Error Handling

### Tab Not Found

```typescript
get_page_info({ tabId: "invalid-id" })

// Error response:
{
  error: "Tool 'get_page_info' not available in tab 'invalid-id'. Available tabs: tab-1, tab-2"
}
```

### No Active Tab

```typescript
// All tabs minimized/backgrounded
get_page_info()  // No tabId, no active tab

// Behavior: Uses first available tab + warning log
// Better than error - tool still works
```

### Tool Not Registered

```typescript
// Tab 1: Registers tool A
// Tab 2: Registers tool B

get_tool_b({ tabId: "tab-1" })

// Error:
{
  error: "Tool 'get_tool_b' not available in tab 'tab-1'. Available tabs: tab-2"
}
```

## API Reference

### WorkerClient Methods

#### `getTabId(): string`

Get the unique ID of the current tab.

```typescript
const tabId = workerClient.getTabId();
console.log(tabId); // "550e8400-e29b-41d4-a716-446655440000"
```

#### `getTabInfo(): TabInfo`

Get detailed info about current tab.

```typescript
const info = workerClient.getTabInfo();
// {
//   tabId: "550e8400-...",
//   isActive: true,
//   url: "https://app.example.com/dashboard",
//   title: "Dashboard - My App"
// }
```

#### `static clearTabId(): void`

Clear tab ID from sessionStorage (for testing).

```typescript
WorkerClient.clearTabId();
// Refresh page to generate new ID
```

### MCPController Methods

#### `handleRegisterTab(data): void`

Register a tab with the worker (called automatically).

#### `handleSetActiveTab(data): void`

Update active tab tracking (called automatically).

## Best Practices

### 1. Let Auto-Routing Work

Don't pass `tabId` unless you need to target a specific tab:

```typescript
// ✅ Good - natural interaction
get_page_info()

// ❌ Unnecessary - harder to use
get_page_info({ tabId: workerClient.getTabId() })
```

### 2. Use Discovery When Needed

Use `list_browser_tabs` when you need tab-specific operations:

```typescript
// ✅ Good - explicit discovery
const tabs = await list_browser_tabs();
const settingsTab = tabs.find(t => t.url.includes('/settings'));
await get_state({ tabId: settingsTab.tabId });

// ❌ Bad - guessing tab IDs
await get_state({ tabId: "some-random-id" });
```

### 3. Design Stateless Tools

Prefer tools that don't depend heavily on local component state:

```typescript
// ✅ Good - API calls work from any tab
registerTool('fetch_user', async (args) => {
  const response = await fetch(`/api/users/${args.id}`);
  return { content: [{ type: 'text', text: await response.text() }] };
});

// ⚠️ Be aware - local state might differ per tab
registerTool('get_form_state', async () => {
  const formState = useFormStore.getState(); // Different per tab
  return { content: [{ type: 'text', text: JSON.stringify(formState) }] };
});
```

### 4. Document Tab-Specific Behavior

If your tool behaves differently per tab, document it:

```typescript
registerTool(
  'get_user_preferences',
  'Get user preferences from current tab context. NOTE: Preferences may differ per tab if user is editing in multiple tabs.',
  schema,
  handler
);
```

## Migration from Single-Tab

Existing single-tab code works without changes:

```typescript
// Before (single-tab)
await workerClient.registerTool('my_tool', ...);

// After (multi-tab) - same code works!
await workerClient.registerTool('my_tool', ...);
// Now works across multiple tabs automatically
```

The `tabId` parameter is optional, so existing tools continue to work with the focused tab.

## Troubleshooting

### Issue: Tool calls go to wrong tab

**Solution**: Use `list_browser_tabs` to verify which tab you're targeting:

```typescript
const tabs = await list_browser_tabs();
console.log(tabs);
// Find the correct tabId
```

### Issue: Tab ID changes on refresh

**Check**: SessionStorage might be disabled (private mode)

```typescript
// Test sessionStorage
try {
  sessionStorage.setItem('test', '1');
  sessionStorage.removeItem('test');
  console.log('SessionStorage works ✓');
} catch {
  console.log('SessionStorage blocked ✗');
  // Fallback ID will be used (changes on refresh)
}
```

### Issue: Multiple tabs show same tool registered multiple times

**This is expected**: Reference counting means:
- Tool registered once with MCP
- Multiple tabs can have handlers
- Worker routes to correct tab automatically

## Performance

Multi-tab adds minimal overhead:

- Tab registration: ~1ms
- Tab routing: ~0.1ms (Map lookup)
- Memory per tab: ~100 bytes (tab info)

Total overhead for 10 tabs: < 1ms + 1KB memory

## Security

Tab IDs are not secret:
- Used for routing only
- No authentication/authorization
- All tabs in same browser share worker

Do not use tab IDs as security tokens.

## See Also

- [Architecture](./architecture.md) - Detailed architecture diagrams
- [Guide](./guide.md) - General usage guide
- [API Reference](./api.md) - Complete API documentation
