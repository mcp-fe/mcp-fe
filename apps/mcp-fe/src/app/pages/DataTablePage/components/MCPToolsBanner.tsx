export const MCPToolsBanner = () => {
  return (
    <div
      className="mcp-tools-info"
      style={{
        background: '#e3f2fd',
        border: '1px solid #2196f3',
        borderRadius: '4px',
        padding: '12px 16px',
        marginBottom: '20px',
      }}
    >
      <strong>
        <span role="img" aria-label="robot">
          🤖
        </span>{' '}
        MCP Tools Available:
      </strong>
      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
        <li>
          <code>get_users_table_data</code> - Get all users with filters
        </li>
        <li>
          <code>get_users_table_stats</code> - Get statistics (counts by
          role/status)
        </li>
        <li>
          <code>search_users_table</code> - Search users by name/email
        </li>
        <li>
          <code>get_selected_users</code> - Get currently selected users
        </li>
      </ul>
    </div>
  );
};
