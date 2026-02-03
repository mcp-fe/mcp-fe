import { useMCPGetter } from '@mcp-fe/react-tools';
import { FormData } from '../types';

/**
 * MCP Tool: Get complete form state
 * Exposes the current state of all form fields
 */
export function useFormStateTool(formData: FormData) {
  useMCPGetter(
    'get_form_state',
    'Get the current state of all form fields in the registration form',
    () => ({
      formData,
      fieldCount: Object.keys(formData).length,
      filledFields: Object.entries(formData).filter(
        ([, value]) => value !== '' && value !== false,
      ).length,
    }),
  );
}
