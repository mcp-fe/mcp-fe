import { useMCPTool } from '@mcp-fe/react-tools';
import { FormData } from '../types';
import { formStateOutputJsonSchema } from './schemas';

/**
 * MCP Tool: Get complete form state
 * Exposes the current state of all form fields with structured output
 */
export function useFormStateTool(formData: FormData) {
  useMCPTool({
    name: 'get_form_state',
    description:
      'Get the current state of all form fields in the registration form',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: formStateOutputJsonSchema,
    handler: async () => {
      const result = {
        formData,
        fieldCount: Object.keys(formData).length,
        filledFields: Object.entries(formData).filter(
          ([, value]) => value !== '' && value !== false,
        ).length,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    },
  });
}
