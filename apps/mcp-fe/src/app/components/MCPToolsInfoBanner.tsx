/**
 * MCPToolsInfoBanner - Generic component for displaying available MCP tools
 */
import { ReactNode } from 'react';

export interface MCPTool {
  name: string;
  description: string;
}

export interface MCPToolsInfoBannerProps {
  title?: string;
  description?: string | ReactNode;
  icon?: string;
  iconLabel?: string;
  tools: MCPTool[];
}

export const MCPToolsInfoBanner = ({
  title = 'MCP Tools Available',
  description,
  icon = '🔧',
  iconLabel = 'tools',
  tools,
}: MCPToolsInfoBannerProps) => {
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
        <span role="img" aria-label={iconLabel}>
          {icon}
        </span>{' '}
        {title}
      </h3>
      {description && <p>{description}</p>}
      <ul style={{ marginBottom: 0 }}>
        {tools.map((tool, index) => (
          <li key={index}>
            <code>{tool.name}</code> - {tool.description}
          </li>
        ))}
      </ul>
    </div>
  );
};
