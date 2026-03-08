import { MCPToolsInfoBanner } from '../../components/MCPToolsInfoBanner';
import { FORMS_TOOL_NAMES } from './mcp-tools/useFormsMCPTools';

/**
 * Component that displays information about available MCP tools for the form
 */
export const MCPToolsInfo = () => {
  return (
    <MCPToolsInfoBanner
      title="MCP Tools Available"
      toolNames={FORMS_TOOL_NAMES}
      description={
        <>
          This form exposes <strong>MCP tools</strong> that AI assistants can
          use to inspect the form state in real-time:
        </>
      }
    />
  );
};
