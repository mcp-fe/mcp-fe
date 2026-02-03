/**
 * Form validation function
 */

import { FormData } from './types';

export const validateForm = (data: FormData): Partial<FormData> => {
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
