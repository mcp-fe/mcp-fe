import { useState, FormEvent } from 'react';
import { FormData } from './types';
import { validateForm } from './formValidation';
import { MCPToolsInfo } from './MCPToolsInfo';
import { RegistrationForm } from './RegistrationForm';
import {
  useFormStateTool,
  useFormValidationTool,
  useFormCompletionTool,
  useFieldInfoTool,
  useValidateFormNowTool,
  useFormAnalyticsTool,
  useFillFieldTool,
} from './mcp-tools';

export const FormsPage = () => {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    age: '',
    country: '',
    newsletter: false,
    plan: 'basic',
    message: '',
  });

  const [validationErrors, setValidationErrors] = useState<Partial<FormData>>(
    {},
  );

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear validation error when user starts typing
    if (validationErrors[name as keyof FormData]) {
      setValidationErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const errors = validateForm(formData);
    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        age: '',
        country: '',
        newsletter: false,
        plan: 'basic',
        message: '',
      });

      alert(
        'Form submitted successfully! Check the Live Event Log in the right sidebar to see the tracked data.',
      );
    }
  };

  // ===== MCP Tools Integration =====
  // Register all MCP tools for form state inspection
  useFormStateTool(formData);
  useFormValidationTool(formData, validateForm);
  useFormCompletionTool(formData);
  useFieldInfoTool(formData, validationErrors, validateForm);
  useValidateFormNowTool(formData, validateForm);
  useFormAnalyticsTool(formData);
  useFillFieldTool(setFormData);

  return (
    <div className="forms-page">
      <h2>Forms Demo - Interactive State Management</h2>
      <p>
        This interactive form showcases real-time state tracking and validation
        with <strong>7 MCP tools</strong> that AI assistants can use to inspect
        and interact with the form. Try filling out the form below - all field
        changes, validations, and user interactions are tracked and accessible
        through the MCP interface. You can also view all events in the{' '}
        <strong>Live Event Log</strong> sidebar.
      </p>

      <MCPToolsInfo />

      <RegistrationForm
        formData={formData}
        validationErrors={validationErrors}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
