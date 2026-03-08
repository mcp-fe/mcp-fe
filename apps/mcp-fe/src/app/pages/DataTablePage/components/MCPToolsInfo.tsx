import { MCPToolsInfoBanner } from '../../../components/MCPToolsInfoBanner';
import { DATA_TABLE_TOOL_NAMES } from '../mcp-tools/useDataTableMCPTools';

export const MCPToolsInfo = () => {
  return (
    <MCPToolsInfoBanner
      title="MCP Tools Available"
      toolNames={DATA_TABLE_TOOL_NAMES}
    />
  );
};
