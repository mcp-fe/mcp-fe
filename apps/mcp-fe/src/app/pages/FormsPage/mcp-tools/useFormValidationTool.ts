import { useMCPGetter } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Get validation status
 * Returns validation errors and status for the form
 */
export function useFormValidationTool(
  formData: FormData,
  validateForm: (data: FormData) => Partial<FormData>,
) {
  useMCPGetter(
    'get_form_validation_status',
    'Get validation status and errors for the registration form',
    () => {
      const currentErrors = validateForm(formData);
      return {
        isValid: Object.keys(currentErrors).length === 0,
        errorCount: Object.keys(currentErrors).length,
        errors: currentErrors,
        fieldsWithErrors: Object.keys(currentErrors),
      };
    },
  );
}
