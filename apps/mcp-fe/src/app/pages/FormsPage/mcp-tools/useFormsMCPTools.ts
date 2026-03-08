import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { useFormsToolsContext } from '../FormsToolsContext';
import { type FormData } from '../types';

export const FORMS_TOOL_NAMES = [
  'get_form_state',
  'submit_form',
  'get_form_completion',
  'get_field_info',
  'validate_form',
  'get_form_analytics',
  'fill_field',
] as const;

interface UseFormsMCPToolsProps {
  formData: FormData;
  validationErrors: Partial<FormData>;
  setFormData: Dispatch<SetStateAction<FormData>>;
  setValidationErrors: Dispatch<SetStateAction<Partial<FormData>>>;
}

/**
 * Composite hook that syncs the form state to the always-registered MCP tools.
 * Call this from FormsPage with the current state — tools become active while
 * the page is mounted and return a friendly error when the page is not active.
 */
export function useFormsMCPTools({
  formData,
  validationErrors,
  setFormData,
  setValidationErrors,
}: UseFormsMCPToolsProps) {
  const { setToolState } = useFormsToolsContext();

  useEffect(() => {
    setToolState({ formData, validationErrors, setFormData, setValidationErrors });
    return () => setToolState(null);
    // setFormData and setValidationErrors are stable React state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, validationErrors, setToolState]);
}
