import { useMCPGetter } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Get form analytics/statistics
 * Returns analytics and statistics about the form state
 */
export function useFormAnalyticsTool(formData: FormData) {
  useMCPGetter(
    'get_form_analytics',
    'Get analytics and statistics about the form state',
    () => {
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

      return {
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
    },
  );
}
