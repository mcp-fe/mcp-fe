import { useMCPTool } from '@mcp-fe/react-tools';
import { FormData } from '../types';
import { formCompletionOutputJsonSchema } from './schemas';

/**
 * MCP Tool: Get form completion progress
 * Returns progress information and which fields are filled with structured output
 */
export function useFormCompletionTool(formData: FormData) {
  useMCPTool({
    name: 'get_form_completion',
    description:
      'Get form completion progress including which fields are filled',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: formCompletionOutputJsonSchema,
    handler: async () => {
      const requiredFields: (keyof FormData)[] = [
        'firstName',
        'lastName',
        'email',
      ];
      const filledRequired = requiredFields.filter((field) => {
        const value = formData[field];
        return value !== '' && value !== null && value !== undefined;
      });

      const totalFields = 8; // All form fields
      const filledFields = Object.entries(formData).filter(
        ([, value]) => value !== '' && value !== false,
      ).length;

      const result = {
        isComplete: filledRequired.length === requiredFields.length,
        completionPercentage: Math.round((filledFields / totalFields) * 100),
        requiredFieldsStatus: {
          firstName: !!formData.firstName,
          lastName: !!formData.lastName,
          email: !!formData.email,
        },
        optionalFieldsStatus: {
          age: !!formData.age,
          country: !!formData.country,
          message: !!formData.message,
          newsletter: formData.newsletter,
        },
        missingRequiredFields: requiredFields.filter(
          (f) => !filledRequired.includes(f),
        ),
        totalFields,
        filledFields,
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
