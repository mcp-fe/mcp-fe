import { useMCPGetter } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Validate form
 * Runs validation on the current form state and returns all errors without submitting
 */
export function useValidateFormTool(
  formData: FormData,
  validateForm: (data: FormData) => Partial<FormData>,
) {
  useMCPGetter(
    'validate_form',
    'Run validation on the current form state and return all errors',
    () => {
      const errors = validateForm(formData);
      return {
        isValid: Object.keys(errors).length === 0,
        canSubmit: Object.keys(errors).length === 0,
        errors,
        validFields: Object.keys(formData).filter(
          (field) => !errors[field as keyof FormData],
        ),
        invalidFields: Object.keys(errors),
      };
    },
  );
}
