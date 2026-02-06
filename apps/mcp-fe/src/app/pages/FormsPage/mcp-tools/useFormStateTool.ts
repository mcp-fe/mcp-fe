import { useMCPTool } from '@mcp-fe/react-tools';
import { z } from 'zod';
import { FormData } from '../types';

// Output schema for form state
const formStateOutputSchema = z.object({
  formData: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    age: z.string().optional(),
    country: z.string().optional(),
    newsletter: z.boolean().optional(),
    plan: z.string().optional(),
    message: z.string().optional(),
  }),
  fieldCount: z.number(),
  filledFields: z.number(),
});

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
    outputSchema: formStateOutputSchema.toJSONSchema(),
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
