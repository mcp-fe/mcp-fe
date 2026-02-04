import { useMCPAction } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Submit form
 * Validates and submits the registration form
 */
export function useSubmitFormTool(
  formData: FormData,
  validateForm: (data: FormData) => Partial<FormData>,
  setValidationErrors: React.Dispatch<React.SetStateAction<Partial<FormData>>>,
  setFormData: React.Dispatch<React.SetStateAction<FormData>>,
) {
  useMCPAction(
    'submit_form',
    'Validate and submit the registration form. Returns validation errors if form is invalid, or success message if form was submitted.',
    {},
    async () => {
      const errors = validateForm(formData);
      setValidationErrors(errors);

      if (Object.keys(errors).length === 0) {
        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          age: '',
          country: '',
          newsletter: false,
          plan: 'basic',
          message: '',
        });

        return {
          success: true,
          message: 'Form submitted successfully! The form has been reset.',
          submittedData: formData,
        };
      } else {
        return {
          success: false,
          message: 'Form validation failed. Please fix the errors.',
          isValid: false,
          errorCount: Object.keys(errors).length,
          errors: errors,
          fieldsWithErrors: Object.keys(errors),
        };
      }
    },
    { required: [] },
  );
}
