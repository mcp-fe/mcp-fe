import { MCPToolsInfoBanner } from '../../../components/MCPToolsInfoBanner';

export const MCPToolsInfo = () => {
  return (
    <MCPToolsInfoBanner
      title="MCP Tools Available"
      filterPattern={/^(get_users_table|search_users_table|get_selected_users)/}
    />
  );
};
