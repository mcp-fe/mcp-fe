import { useMCPTool } from '@mcp-fe/react-tools';
import { z } from 'zod';
import { FormData } from '../types';

// Input schema
const fieldInfoInputSchema = z.object({
  fieldName: z.enum([
    'firstName',
    'lastName',
    'email',
    'age',
    'country',
    'newsletter',
    'plan',
    'message',
  ]),
});

// Output schema for field info
const fieldInfoOutputSchema = z.object({
  fieldName: z.string(),
  value: z.union([z.string(), z.boolean()]),
  hasError: z.boolean(),
  errorMessage: z.string().nullable(),
  isFilled: z.boolean(),
  valueType: z.string(),
  wouldBeValidIfSubmitted: z.boolean(),
});

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
    inputSchema: fieldInfoInputSchema.toJSONSchema(),
    outputSchema: fieldInfoOutputSchema.toJSONSchema(),
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
