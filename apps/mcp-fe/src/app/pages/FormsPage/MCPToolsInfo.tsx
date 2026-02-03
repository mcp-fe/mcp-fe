import { MCPToolsInfoBanner } from '../../components/MCPToolsInfoBanner';

/**
 * Component that displays information about available MCP tools for the form
 */
export const MCPToolsInfo = () => {
  const tools = [
    {
      name: 'get_form_state',
      description: 'View all current field values',
    },
    {
      name: 'get_form_validation_status',
      description: 'Check validation errors',
    },
    {
      name: 'get_form_completion',
      description: 'See progress and which fields are filled',
    },
    {
      name: 'get_field_info',
      description: 'Get detailed info about a specific field',
    },
    {
      name: 'validate_form_now',
      description: 'Run validation and see if form can be submitted',
    },
    {
      name: 'get_form_analytics',
      description: 'Get statistics and analytics about form data',
    },
    {
      name: 'fill_field',
      description: 'Fill a specific form field with a value',
    },
  ];

  return (
    <MCPToolsInfoBanner
      title="MCP Tools Available"
      description={
        <>
          This form exposes <strong>7 MCP tools</strong> that AI assistants can
          use to inspect the form state in real-time:
        </>
      }
      tools={tools}
    />
  );
};
