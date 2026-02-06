import { useMCPTool } from '@mcp-fe/react-tools';
import { z } from 'zod';
import { FormData } from '../types';

// Output schema for form validation
const formValidationOutputSchema = z.object({
  isValid: z.boolean(),
  errors: z.record(z.string(), z.string()),
  errorCount: z.number(),
  validFields: z.array(z.string()),
  invalidFields: z.array(z.string()),
  fieldStatuses: z.record(
    z.string(),
    z.object({
      isValid: z.boolean(),
      error: z.string().optional(),
    }),
  ),
});

/**
 * MCP Tool: Validate form
 * Runs validation on the current form state and returns all errors without submitting
 */
export function useValidateFormTool(
  formData: FormData,
  validateForm: (data: FormData) => Partial<FormData>,
) {
  useMCPTool({
    name: 'validate_form',
    description:
      'Run validation on the current form state and return all errors',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: formValidationOutputSchema.toJSONSchema(),
    handler: async () => {
      const errors = validateForm(formData);
      const validFields = Object.keys(formData).filter(
        (field) => !errors[field as keyof FormData],
      );
      const invalidFields = Object.keys(errors);

      const fieldStatuses: Record<
        string,
        { isValid: boolean; error?: string }
      > = {};
      Object.keys(formData).forEach((field) => {
        const error = errors[field as keyof FormData];
        fieldStatuses[field] = {
          isValid: !error,
          error: error && typeof error === 'string' ? error : undefined,
        };
      });

      const result = {
        isValid: invalidFields.length === 0,
        errors: errors as Record<string, string>,
        errorCount: invalidFields.length,
        validFields,
        invalidFields,
        fieldStatuses,
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
