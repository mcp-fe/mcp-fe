import { useMCPAction } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Get specific field info
 * Returns detailed information about a specific form field
 */
export function useFieldInfoTool(
  formData: FormData,
  validationErrors: Partial<FormData>,
  validateForm: (data: FormData) => Partial<FormData>,
) {
  useMCPAction(
    'get_field_info',
    'Get detailed information about a specific form field',
    {
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
    async (args: { fieldName: keyof FormData }) => {
      const { fieldName } = args;
      const value = formData[fieldName];
      const error = validationErrors[fieldName];
      const currentErrors = validateForm(formData);

      return {
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
    },
  );
}
