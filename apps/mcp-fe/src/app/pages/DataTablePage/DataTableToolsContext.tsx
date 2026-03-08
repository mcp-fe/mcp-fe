import { createContext, useContext, useState, type ReactNode } from 'react';
import { useTableDataTool } from './mcp-tools/useTableDataTool';
import { useTableStatsTool } from './mcp-tools/useTableStatsTool';
import { useSearchUsersTool } from './mcp-tools/useSearchUsersTool';
import { useSelectedUsersTool } from './mcp-tools/useSelectedUsersTool';
import type { DataTableMCPToolsProps } from './mcp-tools/useDataTableMCPTools';

interface DataTableToolsContextValue {
  setToolState: (state: DataTableMCPToolsProps | null) => void;
}

const DataTableToolsContext = createContext<DataTableToolsContextValue>({
  setToolState: () => {},
});

export function DataTableToolsProvider({ children }: { children: ReactNode }) {
  const [toolState, setToolState] = useState<DataTableMCPToolsProps | null>(null);

  useTableDataTool(toolState);
  useTableStatsTool(toolState);
  useSearchUsersTool(toolState ? { users: toolState.users } : null);
  useSelectedUsersTool(
    toolState ? { users: toolState.users, selectedUsers: toolState.selectedUsers } : null,
  );

  return (
    <DataTableToolsContext.Provider value={{ setToolState }}>
      {children}
    </DataTableToolsContext.Provider>
  );
}

export const useDataTableToolsContext = () => useContext(DataTableToolsContext);
