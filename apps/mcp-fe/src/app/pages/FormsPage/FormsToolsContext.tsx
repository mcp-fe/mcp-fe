import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { useFormStateTool } from './mcp-tools/useFormStateTool';
import { useSubmitFormTool } from './mcp-tools/useSubmitFormTool';
import { useFormCompletionTool } from './mcp-tools/useFormCompletionTool';
import { useFieldInfoTool } from './mcp-tools/useFieldInfoTool';
import { useValidateFormTool } from './mcp-tools/useValidateFormTool';
import { useFormAnalyticsTool } from './mcp-tools/useFormAnalyticsTool';
import { useFillFieldTool } from './mcp-tools/useFillFieldTool';
import { validateForm } from './formValidation';
import { type FormData } from './types';

export interface FormsToolState {
  formData: FormData;
  validationErrors: Partial<FormData>;
  setFormData: Dispatch<SetStateAction<FormData>>;
  setValidationErrors: Dispatch<SetStateAction<Partial<FormData>>>;
}

interface FormsToolsContextValue {
  setToolState: (state: FormsToolState | null) => void;
}

const FormsToolsContext = createContext<FormsToolsContextValue>({
  setToolState: () => {},
});

export function FormsToolsProvider({ children }: { children: ReactNode }) {
  const [toolState, setToolState] = useState<FormsToolState | null>(null);

  useFormStateTool(toolState?.formData ?? null);
  useSubmitFormTool(
    toolState?.formData ?? null,
    validateForm,
    toolState?.setValidationErrors ?? null,
    toolState?.setFormData ?? null,
  );
  useFormCompletionTool(toolState?.formData ?? null);
  useFieldInfoTool(
    toolState?.formData ?? null,
    toolState?.validationErrors ?? null,
    validateForm,
  );
  useValidateFormTool(toolState?.formData ?? null, validateForm);
  useFormAnalyticsTool(toolState?.formData ?? null);
  useFillFieldTool(toolState?.formData ?? null, toolState?.setFormData ?? null);

  return (
    <FormsToolsContext.Provider value={{ setToolState }}>
      {children}
    </FormsToolsContext.Provider>
  );
}

export const useFormsToolsContext = () => useContext(FormsToolsContext);
