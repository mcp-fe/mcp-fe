interface AIAgentInstructionsProps {
  token?: string | null;
}

export const AIAgentInstructions = ({ token }: AIAgentInstructionsProps) => {
  return (
    <>
      <p>
        Follow these steps to connect your AI agent (Claude Desktop, Cline,
        etc.) to the MCP Proxy Server and access tracked events:
      </p>

      <h3>1. Start the MCP Proxy Server</h3>
      <p>If you haven't already, start the server using Docker or locally:</p>
      <pre>
        <code>
          {`# Using Docker (recommended)
docker run -p 3001:3001 ghcr.io/mcp-fe/mcp-fe/mcp-server:main

# Or run locally
pnpm install
nx run mcp-server:serve`}
        </code>
      </pre>

      <h3>2. Configure Your AI Agent</h3>
      <p>Add the MCP server configuration to your AI agent's settings:</p>

      <h4>MCP.json:</h4>
      <pre>
        <code>
          {`{
  "mcpServers": {
    "mcp-fe-proxy": {
      "url": "http://localhost:3001/mcp",
      "transport": "streamable-http"
    }
  }
}`}
        </code>
      </pre>

      <h4>For Other MCP Clients:</h4>
      <p>
        Your MCP Proxy Server uses <strong>Streamable HTTP transport</strong>{' '}
        (the modern HTTP-based transport for MCP). Configure your client to
        connect to:
      </p>
      <pre>
        <code>http://localhost:3001/mcp</code>
      </pre>
      <p>
        <strong>Important:</strong> Make sure your client supports Streamable
        HTTP transport. STDIO is currently not supported.
      </p>

      <h3>3. Authenticate with Bearer Token</h3>
      <p>
        You need to pass a Bearer token with your session user ID to identify
        your session. The AI agent will use this token to query your specific
        tracked events.
      </p>
      {token && (
        <div>
          <p>
            <strong>Your current token:</strong>
          </p>
          <pre>
            <code>{token}</code>
          </pre>
        </div>
      )}

      <h3>4. Test the Connection</h3>
      <p>Ask your AI agent questions like:</p>
      <ul>
        <li>"What pages have I visited in the last 10 minutes?"</li>
        <li>"What buttons did I click on the Components page?"</li>
        <li>"Analyze my navigation patterns"</li>
      </ul>

      <h3>5. Available MCP Tools</h3>
      <p>The AI agent can use these tools to access your data:</p>
      <ul>
        <li>
          <code>get_user_events</code> - Retrieve tracked events with filtering
        </li>
        <li>
          <code>get_click_events</code> - Retrieve tracked click events with
          filtering
        </li>
        <li>
          <code>get_navigation_history</code> - Get user navigation history
        </li>
      </ul>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f0f7ff',
          borderRadius: '6px',
          borderLeft: '4px solid #0066cc',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          💡 <strong>Tip:</strong> This MCP server uses{' '}
          <strong>Streamable HTTP</strong> transport over HTTP, not stdio. Make
          sure to use the <code>/mcp</code> endpoint and transport in your
          client configuration.
        </p>
      </div>
    </>
  );
};
