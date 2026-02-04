import { MCPToolsInfoBanner } from '../../components/MCPToolsInfoBanner';

/**
 * Component that displays information about available MCP tools for the form
 */
export const MCPToolsInfo = () => {
  const tools = [
    {
      name: 'get_form_state',
      description:
        'Get current values of all form fields (firstName, lastName, email, age, country, newsletter, plan, message)',
    },
    {
      name: 'submit_form',
      description:
        'Validate and submit the registration form. Returns success if valid, or validation errors if invalid. Resets form on success.',
    },
    {
      name: 'validate_form',
      description:
        'Run validation on current form state without submitting. Returns isValid status, error details, and lists of valid/invalid fields.',
    },
    {
      name: 'get_form_completion',
      description:
        'Get form completion status showing which required fields are filled and overall progress percentage.',
    },
    {
      name: 'get_field_info',
      description:
        'Get detailed information about a specific field including value, validation status, requirements, and current errors.',
    },
    {
      name: 'get_form_analytics',
      description:
        'Get statistics about form data: character counts, field lengths, data quality metrics, and validation summary.',
    },
    {
      name: 'fill_field',
      description:
        'Fill a specific form field with a value. Supports all 8 fields with proper type validation.',
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
      tools={tools.map(({ name, description }) => ({ name, description }))}
    />
  );
};
