import { useMCPTool } from '@mcp-fe/react-tools';
import { FormData } from '../types';
import { formValidationOutputJsonSchema } from './schemas';

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
    outputSchema: formValidationOutputJsonSchema,
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
