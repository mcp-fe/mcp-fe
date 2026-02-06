import { useMCPTool } from '@mcp-fe/react-tools';
import { z } from 'zod';
import { FormData } from '../types';

// Output schema for form submission
const submitFormOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errors: z.record(z.string(), z.string()).optional(),
  submittedData: z
    .object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      age: z.string(),
      country: z.string(),
      newsletter: z.boolean(),
      plan: z.string(),
      message: z.string(),
    })
    .optional(),
});

/**
 * MCP Tool: Submit form
 * Validates and submits the registration form with structured output
 */
export function useSubmitFormTool(
  formData: FormData,
  validateForm: (data: FormData) => Partial<FormData>,
  setValidationErrors: React.Dispatch<React.SetStateAction<Partial<FormData>>>,
  setFormData: React.Dispatch<React.SetStateAction<FormData>>,
) {
  useMCPTool({
    name: 'submit_form',
    description:
      'Validate and submit the registration form. Returns validation errors if form is invalid, or success message if form was submitted.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: submitFormOutputSchema.toJSONSchema(),
    handler: async () => {
      const errors = validateForm(formData);
      setValidationErrors(errors);

      if (Object.keys(errors).length === 0) {
        const submittedData = { ...formData };

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

        const result = {
          success: true,
          message: 'Form submitted successfully! The form has been reset.',
          submittedData,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      } else {
        const result = {
          success: false,
          message: 'Form validation failed. Please fix the errors.',
          errors: errors as Record<string, string>,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }
    },
  });
}
