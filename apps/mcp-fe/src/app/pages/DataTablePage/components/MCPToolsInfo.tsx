import { MCPToolsInfoBanner } from '../../../components/MCPToolsInfoBanner';

export const MCPToolsInfo = () => {
  const tools = [
    {
      name: 'get_users_table_data',
      description: 'Get all users with filters',
    },
    {
      name: 'get_users_table_stats',
      description: 'Get statistics (counts by role/status)',
    },
    {
      name: 'search_users_table',
      description: 'Search users by name/email',
    },
    {
      name: 'get_selected_users',
      description: 'Get currently selected users',
    },
  ];

  return <MCPToolsInfoBanner title="MCP Tools Available" tools={tools} />;
};
