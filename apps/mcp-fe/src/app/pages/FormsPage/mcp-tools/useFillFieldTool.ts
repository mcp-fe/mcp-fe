import { useMCPTool } from '@mcp-fe/react-tools';
import { z } from 'zod';
import { FormData } from '../types';

// Input schema
const fillFieldInputSchema = z.object({
  fieldName: z.enum([
    'firstName',
    'lastName',
    'email',
    'age',
    'country',
    'newsletter',
    'plan',
    'message',
  ]),
  value: z.string(),
});

// Output schema for fill field result
const fillFieldOutputSchema = z.object({
  success: z.boolean(),
  fieldName: z.string(),
  newValue: z.string(),
  previousValue: z.string(),
  message: z.string(),
});

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
    inputSchema: fillFieldInputSchema.toJSONSchema(),
    outputSchema: fillFieldOutputSchema.toJSONSchema(),
    handler: async (args: unknown) => {
      const { fieldName, value: valueArg } = args as {
        fieldName: keyof FormData;
        value: string;
      };

      // Parse string value to correct type for the field (e.g. boolean for newsletter, number for age)
      let value: string | boolean | number = valueArg;
      if (fieldName === 'newsletter') {
        const lower = valueArg.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') value = true;
        else if (lower === 'false' || lower === '0' || lower === 'no')
          value = false;
        else throw new Error('Field "newsletter" requires "true" or "false"');
      } else if (fieldName === 'age' && valueArg.trim() !== '') {
        const n = Number(valueArg);
        if (!Number.isNaN(n)) value = n;
      }

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
        newValue: String(newValue),
        previousValue: String(previousValue),
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
