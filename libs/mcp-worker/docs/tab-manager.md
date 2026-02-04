# TabManager

Manages browser tabs and tool registration routing.

## API

### Tab Management

```typescript
// Register tab
tabManager.registerTab(tabId, url, title);

// Set active tab
tabManager.setActiveTab(tabId);

// Get active tab
const activeId = tabManager.getActiveTabId(); // → string | null

// Get all tabs
const tabs = tabManager.getAllTabs(); // → TabInfo[]

// Remove tab
tabManager.removeTab(tabId); // → boolean
```

### Tool Registration

```typescript
// Register tool for tab
const isNew = tabManager.registerToolForTab(toolName, tabId);

// Unregister tool from tab
const result = tabManager.unregisterToolFromTab(toolName, tabId);
// → { wasRemoved, remainingTabs, wasActiveTab }

// Get tabs with tool
const tabs = tabManager.getTabsForTool(toolName); // → Set<string>

// Check if tab has tool
const has = tabManager.tabHasTool(toolName, tabId); // → boolean
```

### Smart Routing

```typescript
const route = tabManager.routeToolCall(toolName, explicitTabId?);
// → { targetTabId: string, reason: string } | null
```

**Priority:**
1. Explicit `tabId` (if valid)
2. Only one tab has tool → use it
3. Active tab has tool → use it
4. Use first available

### Diagnostics

```typescript
// Debug routing
const info = tabManager.getRoutingInfo(toolName);

// Get stats
const stats = tabManager.getStats();

// Clear all (testing)
tabManager.clear();
```

## Usage

```typescript
import { TabManager } from '@mcp-fe/mcp-worker';

const tabs = new TabManager();

// Register tabs
tabs.registerTab('tab-1', '/dashboard', 'Dashboard');
tabs.registerTab('tab-2', '/settings', 'Settings');

// Register tools
tabs.registerToolForTab('get_data', 'tab-1');
tabs.registerToolForTab('get_data', 'tab-2');

// Set active
tabs.setActiveTab('tab-1');

// Route
const route = tabs.routeToolCall('get_data');
// → { targetTabId: 'tab-1', reason: 'active tab has tool' }

// Route to specific tab
const route2 = tabs.routeToolCall('get_data', 'tab-2');
// → { targetTabId: 'tab-2', reason: 'explicit tabId parameter' }
```

## Integration

MCPController uses TabManager internally:

```typescript
class MCPController {
  private tabManager = new TabManager();

  handleRegisterTab(data) {
    this.tabManager.registerTab(data.tabId, data.url, data.title);
  }

  async handleRegisterToolInternal(toolData) {
    const isNew = this.tabManager.registerToolForTab(toolData.name, toolData.tabId);
    
    if (!isNew) return;
    
    // Create handler with routing
    const handler = async (args) => {
      const route = this.tabManager.routeToolCall(toolData.name, args.tabId);
      if (!route) throw new Error('Tool not available');
      
      return this.sendToolCall(route.targetTabId, args);
    };
    
    toolRegistry.register({ name: toolData.name }, handler);
  }
}
```

## Why Separate Class?

- **Separation of Concerns**: Tab logic separate from MCP protocol
- **Testable**: Easy to unit test without MCP dependencies
- **Reusable**: Can be used in other contexts
- **Type Safe**: Strong typing throughout

```typescript
// Example test
test('routes to only available tab', () => {
  const tabs = new TabManager();
  tabs.registerTab('tab-1', '/page', 'Page');
  tabs.registerTab('tab-2', '/page', 'Page');
  tabs.registerToolForTab('tool', 'tab-1');
  tabs.setActiveTab('tab-2'); // Active tab doesn't have tool
  
  const route = tabs.routeToolCall('tool');
  expect(route.targetTabId).toBe('tab-1');
});
```

## See Also

- [Multi-Tab Guide](./multi-tab.md) - Complete multi-tab docs
- [Architecture](./architecture.md) - System architecture
