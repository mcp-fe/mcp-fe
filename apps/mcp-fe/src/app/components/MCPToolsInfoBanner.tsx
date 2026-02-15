/**
 * MCPToolsInfoBanner - Generic component for displaying available MCP tools
 */
import { ReactNode, useEffect, useState } from 'react';
import { getRegisteredTools, getToolDetails } from '@mcp-fe/react-tools';

export interface MCPTool {
  name: string;
  description: string;
}

export interface MCPToolsInfoBannerProps {
  title?: string;
  description?: string | ReactNode;
  icon?: string;
  iconLabel?: string;
  tools?: MCPTool[]; // Optional - if not provided, will fetch from registry
  filterPattern?: RegExp; // Optional - filter tools by name pattern
}

export const MCPToolsInfoBanner = ({
  title = 'MCP Tools Available',
  description,
  icon = '🔧',
  iconLabel = 'tools',
  tools: providedTools,
  filterPattern,
}: MCPToolsInfoBannerProps) => {
  const [tools, setTools] = useState<MCPTool[]>(providedTools || []);

  useEffect(() => {
    // If tools are provided explicitly, use them
    if (providedTools) {
      setTools(providedTools);
      return;
    }

    // Otherwise, fetch from registry
    const fetchTools = () => {
      const registeredToolNames = getRegisteredTools();

      const toolDetails = registeredToolNames
        .map((name) => {
          const details = getToolDetails(name);
          if (!details) return null;

          // Apply filter if provided
          if (filterPattern && !filterPattern.test(name)) {
            return null;
          }

          return {
            name: details.name,
            description: details.description || 'No description available',
          };
        })
        .filter((tool): tool is MCPTool => tool !== null);

      setTools(toolDetails);
    };

    // Fetch initially
    fetchTools();

    // Set up polling to keep tools updated
    const interval = setInterval(fetchTools, 1000);

    return () => clearInterval(interval);
  }, [providedTools, filterPattern]);

  // Don't render if no tools
  if (tools.length === 0) {
    return null;
  }
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
