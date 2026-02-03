import { useState, FormEvent } from 'react';
import { useMCPGetter, useMCPAction } from '@mcp-fe/react-tools';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  age: string;
  country: string;
  newsletter: boolean;
  plan: string;
  message: string;
}

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

  const validateForm = (data: FormData): Partial<FormData> => {
    const errors: Partial<FormData> = {};

    if (!data.firstName.trim()) errors.firstName = 'First name is required';
    if (!data.lastName.trim()) errors.lastName = 'Last name is required';
    if (!data.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Invalid email format';
    }
    if (!data.age || parseInt(data.age) < 1 || parseInt(data.age) > 120) {
      errors.age = 'Age must be between 1 and 120';
    }
    if (!data.country) errors.country = 'Please select a country';
    if (data.message.length < 10)
      errors.message = 'Message must be at least 10 characters';

    return errors;
  };

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
  // These tools allow AI/MCP clients to inspect form state in real-time

  // Tool 1: Get complete form state
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

  // Tool 2: Get validation status
  useMCPGetter(
    'get_form_validation_status',
    'Get validation status and errors for the registration form',
    () => {
      const currentErrors = validateForm(formData);
      return {
        isValid: Object.keys(currentErrors).length === 0,
        errorCount: Object.keys(currentErrors).length,
        errors: currentErrors,
        fieldsWithErrors: Object.keys(currentErrors),
      };
    },
  );

  // Tool 3: Get form completion progress
  useMCPGetter(
    'get_form_completion',
    'Get form completion progress including which fields are filled',
    () => {
      const requiredFields = [
        'firstName',
        'lastName',
        'email',
        'age',
        'country',
        'message',
      ];
      const filledRequired = requiredFields.filter((field) => {
        const value = formData[field as keyof FormData];
        return value !== '' && value !== null && value !== undefined;
      });

      const optionalFields = ['newsletter', 'plan'];
      const filledOptional = optionalFields.filter((field) => {
        const value = formData[field as keyof FormData];
        if (field === 'newsletter') return value === true;
        if (field === 'plan') return value !== 'basic'; // Basic is default
        return false;
      });

      return {
        requiredProgress: {
          total: requiredFields.length,
          filled: filledRequired.length,
          percentage: Math.round(
            (filledRequired.length / requiredFields.length) * 100,
          ),
          missing: requiredFields.filter((f) => !filledRequired.includes(f)),
        },
        optionalFields: {
          total: optionalFields.length,
          filled: filledOptional.length,
          details: {
            newsletter: formData.newsletter,
            plan: formData.plan,
          },
        },
        filledFields: {
          firstName: !!formData.firstName,
          lastName: !!formData.lastName,
          email: !!formData.email,
          age: !!formData.age,
          country: !!formData.country,
          message: !!formData.message,
          newsletter: formData.newsletter,
          plan: formData.plan,
        },
      };
    },
  );

  // Tool 4: Get specific field info
  useMCPAction(
    'get_field_info',
    'Get detailed information about a specific form field',
    {
      fieldName: {
        type: 'string',
        description:
          'Field name (firstName, lastName, email, age, country, newsletter, plan, message)',
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
    },
    async (args: { fieldName: keyof FormData }) => {
      const { fieldName } = args;
      const value = formData[fieldName];
      const error = validationErrors[fieldName];
      const currentErrors = validateForm(formData);

      return {
        fieldName,
        value,
        hasError: !!error,
        errorMessage: error || null,
        isFilled:
          value !== '' &&
          value !== null &&
          value !== undefined &&
          value !== false,
        valueType: typeof value,
        wouldBeValidIfSubmitted: !currentErrors[fieldName],
      };
    },
  );

  // Tool 5: Simulate form validation
  useMCPGetter(
    'validate_form_now',
    'Run validation on the current form state and return all errors',
    () => {
      const errors = validateForm(formData);
      return {
        isValid: Object.keys(errors).length === 0,
        canSubmit: Object.keys(errors).length === 0,
        errors,
        validFields: Object.keys(formData).filter(
          (field) => !errors[field as keyof FormData],
        ),
        invalidFields: Object.keys(errors),
      };
    },
  );

  // Tool 6: Get form analytics/statistics
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

  return (
    <div className="forms-page">
      <h2>Forms Demo - Comprehensive Tracking</h2>
      <p>
        This form demonstrates various input types and validation patterns. All
        field interactions, changes, and submissions are automatically tracked
        by the MCP-FE system and visible in the <strong>Live Event Log</strong>{' '}
        on the right.
      </p>

      <div
        className="mcp-tools-info"
        style={{
          background: '#f0f7ff',
          border: '2px solid #0066cc',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ marginTop: 0, color: '#0066cc' }}>
          <span role="img" aria-label="tools">
            🔧
          </span>{' '}
          MCP Tools Available
        </h3>
        <p>
          This form exposes <strong>6 MCP tools</strong> that AI assistants can
          use to inspect the form state in real-time:
        </p>
        <ul style={{ marginBottom: 0 }}>
          <li>
            <code>get_form_state</code> - View all current field values
          </li>
          <li>
            <code>get_form_validation_status</code> - Check validation errors
          </li>
          <li>
            <code>get_form_completion</code> - See progress and which fields are
            filled
          </li>
          <li>
            <code>get_field_info</code> - Get detailed info about a specific
            field
          </li>
          <li>
            <code>validate_form_now</code> - Run validation and see if form can
            be submitted
          </li>
          <li>
            <code>get_form_analytics</code> - Get statistics and analytics about
            form data
          </li>
        </ul>
      </div>

      <div className="form-section">
        <h3>User Registration Form</h3>
        <form onSubmit={handleSubmit} className="demo-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className={validationErrors.firstName ? 'error' : ''}
                placeholder="Enter your first name"
              />
              {validationErrors.firstName && (
                <span className="error-message">
                  {validationErrors.firstName}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className={validationErrors.lastName ? 'error' : ''}
                placeholder="Enter your last name"
              />
              {validationErrors.lastName && (
                <span className="error-message">
                  {validationErrors.lastName}
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={validationErrors.email ? 'error' : ''}
              placeholder="your.email@example.com"
            />
            {validationErrors.email && (
              <span className="error-message">{validationErrors.email}</span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="age">Age *</label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                className={validationErrors.age ? 'error' : ''}
                placeholder="25"
                min="1"
                max="120"
              />
              {validationErrors.age && (
                <span className="error-message">{validationErrors.age}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="country">Country *</label>
              <select
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className={validationErrors.country ? 'error' : ''}
              >
                <option value="">Select a country</option>
                <option value="us">United States</option>
                <option value="uk">United Kingdom</option>
                <option value="ca">Canada</option>
                <option value="de">Germany</option>
                <option value="fr">France</option>
                <option value="cz">Czech Republic</option>
                <option value="other">Other</option>
              </select>
              {validationErrors.country && (
                <span className="error-message">
                  {validationErrors.country}
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Subscription Plan</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="plan"
                  value="basic"
                  checked={formData.plan === 'basic'}
                  onChange={handleInputChange}
                />
                Basic (Free)
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="plan"
                  value="premium"
                  checked={formData.plan === 'premium'}
                  onChange={handleInputChange}
                />
                Premium ($9.99/month)
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="plan"
                  value="enterprise"
                  checked={formData.plan === 'enterprise'}
                  onChange={handleInputChange}
                />
                Enterprise (Contact us)
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="newsletter"
                checked={formData.newsletter}
                onChange={handleInputChange}
              />
              Subscribe to our newsletter for updates
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="message">Message *</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              className={validationErrors.message ? 'error' : ''}
              placeholder="Tell us about your needs or ask a question (minimum 10 characters)"
              rows={4}
            />
            {validationErrors.message && (
              <span className="error-message">{validationErrors.message}</span>
            )}
          </div>

          <button type="submit" className="submit-btn">
            Submit Registration
          </button>
        </form>
      </div>
    </div>
  );
};
