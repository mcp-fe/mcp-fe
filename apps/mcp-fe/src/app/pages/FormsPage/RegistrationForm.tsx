import { FormEvent } from 'react';
import { FormData } from './types';

interface RegistrationFormProps {
  formData: FormData;
  validationErrors: Partial<FormData>;
  onInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  onSubmit: (e: FormEvent) => void;
}

export const RegistrationForm = ({
  formData,
  validationErrors,
  onInputChange,
  onSubmit,
}: RegistrationFormProps) => {
  return (
    <div className="form-section">
      <h3>User Registration Form</h3>
      <form onSubmit={onSubmit} className="demo-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name *</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={onInputChange}
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
              onChange={onInputChange}
              className={validationErrors.lastName ? 'error' : ''}
              placeholder="Enter your last name"
            />
            {validationErrors.lastName && (
              <span className="error-message">{validationErrors.lastName}</span>
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
            onChange={onInputChange}
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
              onChange={onInputChange}
              className={validationErrors.age ? 'error' : ''}
              placeholder="25"
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
              onChange={onInputChange}
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
              <span className="error-message">{validationErrors.country}</span>
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
                onChange={onInputChange}
              />
              Basic (Free)
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="plan"
                value="premium"
                checked={formData.plan === 'premium'}
                onChange={onInputChange}
              />
              Premium ($9.99/month)
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="plan"
                value="enterprise"
                checked={formData.plan === 'enterprise'}
                onChange={onInputChange}
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
              onChange={onInputChange}
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
            onChange={onInputChange}
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
  );
};
