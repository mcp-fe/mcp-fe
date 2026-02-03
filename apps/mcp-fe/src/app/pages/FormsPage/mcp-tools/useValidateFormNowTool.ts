import { useMCPGetter } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Simulate form validation
 * Runs validation on the current form state and returns all errors
 */
export function useValidateFormNowTool(
  formData: FormData,
  validateForm: (data: FormData) => Partial<FormData>,
) {
  useMCPGetter(
    'validate_form_now',
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
