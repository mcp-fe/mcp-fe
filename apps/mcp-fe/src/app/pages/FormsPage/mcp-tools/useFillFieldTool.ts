import { useMCPAction } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Fill specific field
 * Allows AI to fill a specific form field with a value
 */
export function useFillFieldTool(
  setFormData: React.Dispatch<React.SetStateAction<FormData>>,
) {
  useMCPAction(
    'fill_field',
    'Fill a specific form field with a value.',
    {
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
    async (args: {
      fieldName: keyof FormData;
      value: string | boolean | number;
    }) => {
      const { fieldName, value } = args;

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
        return {
          success: false,
          error: `Invalid field name: ${fieldName}`,
          validFields,
        };
      }

      // Type validation based on field
      if (fieldName === 'newsletter' && typeof value !== 'boolean') {
        return {
          success: false,
          error: 'Field "newsletter" requires a boolean value',
        };
      }

      if (
        fieldName === 'age' &&
        typeof value !== 'string' &&
        typeof value !== 'number'
      ) {
        return {
          success: false,
          error: 'Field "age" requires a string or number value',
        };
      }

      // Update the form data
      setFormData((prev) => ({
        ...prev,
        [fieldName]: fieldName === 'age' ? String(value) : value,
      }));

      return {
        success: true,
        fieldName,
        value,
        message: `Field "${fieldName}" has been set to: ${value}`,
      };
    },
    { required: ['fieldName', 'value'] },
  );
}
