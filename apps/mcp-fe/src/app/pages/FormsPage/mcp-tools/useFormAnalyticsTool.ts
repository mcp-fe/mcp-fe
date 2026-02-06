import { useMCPTool } from '@mcp-fe/react-tools';
import { z } from 'zod';
import { FormData } from '../types';

// Input schema (no parameters)
const formAnalyticsInputSchema = z.object({});

// Output schema for form analytics
const formAnalyticsOutputSchema = z.object({
  characterCounts: z.object({
    firstName: z.number(),
    lastName: z.number(),
    email: z.number(),
    message: z.number(),
  }),
  totalCharacters: z.number(),
  selectedOptions: z.object({
    country: z.string(),
    plan: z.string(),
    newsletter: z.boolean(),
  }),
  validation: z.object({
    emailFormat: z.boolean(),
    ageInRange: z.boolean(),
    messageLength: z.boolean(),
  }),
  completeness: z.object({
    hasName: z.boolean(),
    hasContact: z.boolean(),
    hasAge: z.boolean(),
    hasLocation: z.boolean(),
    hasMessage: z.boolean(),
  }),
});

/**
 * MCP Tool: Get form analytics/statistics
 * Returns analytics and statistics about the form state with structured output
 */
export function useFormAnalyticsTool(formData: FormData) {
  useMCPTool({
    name: 'get_form_analytics',
    description: 'Get analytics and statistics about the form state',
    inputSchema: formAnalyticsInputSchema.toJSONSchema(),
    outputSchema: formAnalyticsOutputSchema.toJSONSchema(),
    handler: async () => {
      const fieldLengths = {
        firstName: formData.firstName.length,
        lastName: formData.lastName.length,
        email: formData.email.length,
        message: formData.message.length,
      };

      const hasValidEmail =
        formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      const hasValidAge =
        formData.age &&
        parseInt(formData.age) >= 1 &&
        parseInt(formData.age) <= 120;

      const result = {
        characterCounts: fieldLengths,
        totalCharacters: Object.values(fieldLengths).reduce(
          (sum, len) => sum + len,
          0,
        ),
        selectedOptions: {
          country: formData.country || 'none',
          plan: formData.plan,
          newsletter: formData.newsletter,
        },
        validation: {
          emailFormat: hasValidEmail,
          ageInRange: hasValidAge,
          messageLength: formData.message.length >= 10,
        },
        completeness: {
          hasName: !!(formData.firstName && formData.lastName),
          hasContact: !!formData.email,
          hasAge: !!formData.age,
          hasLocation: !!formData.country,
          hasMessage: formData.message.length >= 10,
        },
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
