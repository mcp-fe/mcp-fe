# MCP Tools

Custom hooks that expose Data Table functionality to AI agents via MCP (Model Context Protocol).

## What are MCP Tools?

MCP tools allow AI agents (like Claude) to query and interact with your frontend application. These hooks use the `useMCPTool` from `@mcp-fe/react-event-tracker` to register tools that:

- Run handlers in the **main thread** (browser context)
- Have **full access** to React state and browser APIs
- Are **automatically registered** on component mount
- Are **automatically unregistered** on component unmount

## Available Tools

### 1. `useTableDataTool`
**Tool Name:** `get_users_table_data`

Provides AI agents with the current table data including all filters and sorting.

**Input Schema:**
```json
{
  "includeFilters": true  // Optional: include filter information
}
```

**Returns:**
- All users (filtered and sorted)
- Pagination info
- Selected users count
- Optional: current filters

### 2. `useTableStatsTool`
**Tool Name:** `get_users_table_stats`

Provides aggregate statistics about users in the table.

**Returns:**
- Total, filtered, and selected counts
- Counts by role (Admin, User, Editor)
- Counts by status (active, inactive, pending)
- Current filter information

### 3. `useSearchUsersTool`
**Tool Name:** `search_users_table`

Allows AI agents to search users by name or email with optional filters.

**Input Schema:**
```json
{
  "query": "john",        // Required: search query
  "role": "Admin",        // Optional: filter by role
  "status": "active"      // Optional: filter by status
}
```

### 4. `useSelectedUsersTool`
**Tool Name:** `get_selected_users`

Provides the list of currently selected users.

**Returns:**
- Count of selected users
- Full user data for selected rows

### 5. `useDataTableMCPTools` (Composite)

Convenience hook that registers all 4 MCP tools at once.

**Usage:**
```typescript
useDataTableMCPTools({
  users,
  filteredAndSortedUsers,
  currentPage,
  itemsPerPage,
  selectedUsers,
  searchTerm,
  filterRole,
  filterStatus,
  sortField,
  sortDirection
});
```

This is the recommended way to register all tools.

## How It Works

Handlers run in the **main thread**, not in the worker, so they have full access to:
- ✅ React state (users, filters, etc.)
- ✅ Browser APIs (DOM, localStorage, fetch)
- ✅ All your imports and dependencies
- ✅ Real-time data (no caching)

## Adding a New MCP Tool

### Step 1: Create Hook File

```typescript
// mcp-tools/useMyNewTool.ts
import { useMCPTool } from '@mcp-fe/react-tools';

export const useMyNewTool = ({ users }) => {
  useMCPTool({
    name: 'my_new_tool',
    description: 'What it does',
    inputSchema: {
      type: 'object',
      properties: { /* ... */ }
    },
    handler: async (args: unknown) => {
      // Your logic here
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }]
      };
    }
  });
};
```

### Step 2: Add to Composite Hook

```typescript
// useDataTableMCPTools.ts
import { useMyNewTool } from './useMyNewTool';

export const useDataTableMCPTools = (props) => {
  useTableDataTool(props);
  useTableStatsTool(props);
  useSearchUsersTool({ users: props.users });
  useSelectedUsersTool({ users: props.users, selectedUsers: props.selectedUsers });
  useMyNewTool({ users: props.users }); // Add here
};
```

## Best Practices

### Tool Naming
- ✅ Use snake_case: `get_users_table_data`
- ❌ Avoid camelCase: `getUserData`

### Descriptions
- ✅ Clear and specific: "Search users in the data table by name or email with optional role and status filters"
- ❌ Too vague: "Search users"

### Type Safety
```typescript
handler: async (args: unknown) => {
  const typedArgs = args as { query: string; limit?: number };
  // Now you have type safety
}
```

### Error Handling
```typescript
try {
  const result = processData();
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
} catch (error) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ error: error.message })
    }]
  };
}
```

## See Also

- [MCP Worker Documentation](../../../../../libs/mcp-worker/docs/guide.md)
- [React MCP Tools Guide](../../../../../libs/react-event-tracker/REACT_MCP_TOOLS.md)
- [DataTable README](../README.md)
