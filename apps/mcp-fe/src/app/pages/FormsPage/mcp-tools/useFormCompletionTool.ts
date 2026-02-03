import { useMCPGetter } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Get form completion progress
 * Returns progress information and which fields are filled
 */
export function useFormCompletionTool(formData: FormData) {
  useMCPGetter(
    'get_form_completion',
    'Get form completion progress including which fields are filled',
    () => {
      const requiredFields = [
        'firstName',
        'lastName',
        'email',
        'age',
        'country',
        'message',
      ];
      const filledRequired = requiredFields.filter((field) => {
        const value = formData[field as keyof FormData];
        return value !== '' && value !== null && value !== undefined;
      });

      const optionalFields = ['newsletter', 'plan'];
      const filledOptional = optionalFields.filter((field) => {
        const value = formData[field as keyof FormData];
        if (field === 'newsletter') return value === true;
        if (field === 'plan') return value !== 'basic'; // Basic is default
        return false;
      });

      return {
        requiredProgress: {
          total: requiredFields.length,
          filled: filledRequired.length,
          percentage: Math.round(
            (filledRequired.length / requiredFields.length) * 100,
          ),
          missing: requiredFields.filter((f) => !filledRequired.includes(f)),
        },
        optionalFields: {
          total: optionalFields.length,
          filled: filledOptional.length,
          details: {
            newsletter: formData.newsletter,
            plan: formData.plan,
          },
        },
        filledFields: {
          firstName: !!formData.firstName,
          lastName: !!formData.lastName,
          email: !!formData.email,
          age: !!formData.age,
          country: !!formData.country,
          message: !!formData.message,
          newsletter: formData.newsletter,
          plan: formData.plan,
        },
      };
    },
  );
}
