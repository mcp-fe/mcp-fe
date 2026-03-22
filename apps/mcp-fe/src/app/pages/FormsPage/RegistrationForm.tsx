import { FormEvent } from 'react';
import { FormData } from './types';
import styles from './FormsPage.module.scss';

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
    <div className={styles.formSection}>
      <h3>User Registration Form</h3>
      <form onSubmit={onSubmit} className={styles.demoForm}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="firstName">First Name *</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={onInputChange}
              className={validationErrors.firstName ? styles.error : ''}
              placeholder="Enter your first name"
            />
            {validationErrors.firstName && (
              <span className={styles.errorMessage}>
                {validationErrors.firstName}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="lastName">Last Name *</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={onInputChange}
              className={validationErrors.lastName ? styles.error : ''}
              placeholder="Enter your last name"
            />
            {validationErrors.lastName && (
              <span className={styles.errorMessage}>{validationErrors.lastName}</span>
            )}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="email">Email Address *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={onInputChange}
            className={validationErrors.email ? styles.error : ''}
            placeholder="your.email@example.com"
          />
          {validationErrors.email && (
            <span className={styles.errorMessage}>{validationErrors.email}</span>
          )}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="age">Age *</label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age}
              onChange={onInputChange}
              className={validationErrors.age ? styles.error : ''}
              placeholder="25"
            />
            {validationErrors.age && (
              <span className={styles.errorMessage}>{validationErrors.age}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="country">Country *</label>
            <select
              id="country"
              name="country"
              value={formData.country}
              onChange={onInputChange}
              className={validationErrors.country ? styles.error : ''}
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
              <span className={styles.errorMessage}>{validationErrors.country}</span>
            )}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Subscription Plan</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="plan"
                value="basic"
                checked={formData.plan === 'basic'}
                onChange={onInputChange}
              />
              Basic (Free)
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="plan"
                value="premium"
                checked={formData.plan === 'premium'}
                onChange={onInputChange}
              />
              Premium ($9.99/month)
            </label>
            <label className={styles.radioLabel}>
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

        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="newsletter"
              checked={formData.newsletter}
              onChange={onInputChange}
            />
            Subscribe to our newsletter for updates
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="message">Message *</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={onInputChange}
            className={validationErrors.message ? styles.error : ''}
            placeholder="Tell us about your needs or ask a question (minimum 10 characters)"
            rows={4}
          />
          {validationErrors.message && (
            <span className={styles.errorMessage}>{validationErrors.message}</span>
          )}
        </div>

        <button type="submit" className={styles.submitBtn}>
          Submit Registration
        </button>
      </form>
    </div>
  );
};
