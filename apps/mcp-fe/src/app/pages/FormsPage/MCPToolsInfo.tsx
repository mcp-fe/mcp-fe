/**
 * Component that displays information about available MCP tools
 */
export const MCPToolsInfo = () => {
  return (
    <div
      className="mcp-tools-info"
      style={{
        background: '#f0f7ff',
        border: '2px solid #0066cc',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px',
      }}
    >
      <h3 style={{ marginTop: 0, color: '#0066cc' }}>
        <span role="img" aria-label="tools">
          🔧
        </span>{' '}
        MCP Tools Available
      </h3>
      <p>
        This form exposes <strong>6 MCP tools</strong> that AI assistants can
        use to inspect the form state in real-time:
      </p>
      <ul style={{ marginBottom: 0 }}>
        <li>
          <code>get_form_state</code> - View all current field values
        </li>
        <li>
          <code>get_form_validation_status</code> - Check validation errors
        </li>
        <li>
          <code>get_form_completion</code> - See progress and which fields are
          filled
        </li>
        <li>
          <code>get_field_info</code> - Get detailed info about a specific field
        </li>
        <li>
          <code>validate_form_now</code> - Run validation and see if form can be
          submitted
        </li>
        <li>
          <code>get_form_analytics</code> - Get statistics and analytics about
          form data
        </li>
      </ul>
    </div>
  );
};
