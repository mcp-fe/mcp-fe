import { useMCPTool } from '@mcp-fe/react-tools';
import { FormData } from '../types';
import { fillFieldOutputJsonSchema } from './schemas';

/**
 * MCP Tool: Fill specific field
 * Allows AI to fill a specific form field with a value
 */
export function useFillFieldTool(
  formData: FormData,
  setFormData: React.Dispatch<React.SetStateAction<FormData>>,
) {
  useMCPTool({
    name: 'fill_field',
    description: 'Fill a specific form field with a value.',
    inputSchema: {
      type: 'object',
      properties: {
        fieldName: {
          type: 'string',
          description: 'Field name to fill',
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
        value: {
          type: ['string', 'boolean', 'number'],
          description:
            'Value to set. For text fields use string, for newsletter use boolean, for age use number or string. Country values: us (United States), uk (United Kingdom), ca (Canada), de (Germany), fr (France), cz (Czech Republic), other. Plan values: basic, premium, enterprise.',
        },
      },
      required: ['fieldName', 'value'],
    },
    outputSchema: fillFieldOutputJsonSchema,
    handler: async (args: unknown) => {
      const { fieldName, value } = args as {
        fieldName: keyof FormData;
        value: string | boolean | number;
      };

      // Validate field name
      const validFields: (keyof FormData)[] = [
        'firstName',
        'lastName',
        'email',
        'age',
        'country',
        'newsletter',
        'plan',
        'message',
      ];

      if (!validFields.includes(fieldName)) {
        throw new Error(`Invalid field name: ${fieldName}`);
      }

      // Type validation based on field
      if (fieldName === 'newsletter' && typeof value !== 'boolean') {
        throw new Error('Field "newsletter" requires a boolean value');
      }

      if (
        fieldName === 'age' &&
        typeof value !== 'string' &&
        typeof value !== 'number'
      ) {
        throw new Error('Field "age" requires a string or number value');
      }

      const previousValue = formData[fieldName];

      // Update the form data
      setFormData((prev) => ({
        ...prev,
        [fieldName]: fieldName === 'age' ? String(value) : value,
      }));

      const newValue = fieldName === 'age' ? String(value) : value;

      const result = {
        success: true,
        fieldName,
        newValue,
        previousValue,
        message: `Field "${fieldName}" has been set to: ${newValue}`,
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
