import { useMCPTool } from '@mcp-fe/react-tools';
import { FormData } from '../types';
import { fieldInfoOutputJsonSchema } from './schemas';

/**
 * MCP Tool: Get specific field info
 * Returns detailed information about a specific form field with structured output
 */
export function useFieldInfoTool(
  formData: FormData,
  validationErrors: Partial<FormData>,
  validateForm: (data: FormData) => Partial<FormData>,
) {
  useMCPTool({
    name: 'get_field_info',
    description: 'Get detailed information about a specific form field',
    inputSchema: {
      type: 'object',
      properties: {
        fieldName: {
          type: 'string',
          description:
            'Field name (firstName, lastName, email, age, country, newsletter, plan, message)',
          enum: [
            'firstName',
            'lastName',
            'email',
            'age',
            'country',
            'newsletter',
            'plan',
            'message',
          ],
        },
      },
      required: ['fieldName'],
    },
    outputSchema: fieldInfoOutputJsonSchema,
    handler: async (args: unknown) => {
      const { fieldName } = args as { fieldName: keyof FormData };
      const value = formData[fieldName];
      const error = validationErrors[fieldName];
      const currentErrors = validateForm(formData);

      const result = {
        fieldName,
        value,
        hasError: !!error,
        errorMessage: error || null,
        isFilled:
          value !== '' &&
          value !== null &&
          value !== undefined &&
          value !== false,
        valueType: typeof value,
        wouldBeValidIfSubmitted: !currentErrors[fieldName],
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
