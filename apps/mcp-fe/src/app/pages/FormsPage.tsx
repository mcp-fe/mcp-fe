import { useState, FormEvent } from 'react';

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

  const [submitHistory, setSubmitHistory] = useState<FormData[]>([]);
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
      setSubmitHistory((prev) => [...prev, formData]);

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

      alert('Form submitted successfully! Check the submission history below.');
    }
  };

  return (
    <div className="forms-page">
      <h2>Forms Demo - Comprehensive Tracking</h2>
      <p>
        This form demonstrates various input types and validation patterns. All
        field interactions, changes, and submissions are tracked by the MCP-FE
        system.
      </p>

      <div className="forms-layout">
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
                <span className="error-message">
                  {validationErrors.message}
                </span>
              )}
            </div>

            <button type="submit" className="submit-btn">
              Submit Registration
            </button>
          </form>
        </div>

        <div className="submission-history">
          <h3>Submission History</h3>
          {submitHistory.length === 0 ? (
            <p>
              No submissions yet. Fill out the form to see tracked data here.
            </p>
          ) : (
            <div className="submissions-list">
              {submitHistory.map((submission, index) => (
                <div key={index} className="submission-item">
                  <h4>Submission #{index + 1}</h4>
                  <p>
                    <strong>Name:</strong> {submission.firstName}{' '}
                    {submission.lastName}
                  </p>
                  <p>
                    <strong>Email:</strong> {submission.email}
                  </p>
                  <p>
                    <strong>Age:</strong> {submission.age}
                  </p>
                  <p>
                    <strong>Country:</strong> {submission.country}
                  </p>
                  <p>
                    <strong>Plan:</strong> {submission.plan}
                  </p>
                  <p>
                    <strong>Newsletter:</strong>{' '}
                    {submission.newsletter ? 'Yes' : 'No'}
                  </p>
                  <p>
                    <strong>Message:</strong> {submission.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
