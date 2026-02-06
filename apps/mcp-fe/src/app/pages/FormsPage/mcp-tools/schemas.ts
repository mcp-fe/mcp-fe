/**
 * Zod schemas for MCP tool structured outputs
 */

import { z } from 'zod';

// Form state output schema
export const formStateOutputSchema = z.object({
  formData: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    age: z.string().optional(),
    country: z.string().optional(),
    newsletter: z.boolean().optional(),
    plan: z.string().optional(),
    message: z.string().optional(),
  }),
  fieldCount: z.number(),
  filledFields: z.number(),
});

// Form analytics output schema
export const formAnalyticsOutputSchema = z.object({
  characterCounts: z.object({
    firstName: z.number(),
    lastName: z.number(),
    email: z.number(),
    message: z.number(),
  }),
  totalCharacters: z.number(),
  selectedOptions: z.object({
    country: z.string(),
    plan: z.string(),
    newsletter: z.boolean(),
  }),
  validation: z.object({
    emailFormat: z.boolean(),
    ageInRange: z.boolean(),
    messageLength: z.boolean(),
  }),
  completeness: z.object({
    hasName: z.boolean(),
    hasContact: z.boolean(),
    hasAge: z.boolean(),
    hasLocation: z.boolean(),
    hasMessage: z.boolean(),
  }),
});

// Field info output schema
export const fieldInfoOutputSchema = z.object({
  fieldName: z.string(),
  value: z.union([z.string(), z.boolean()]),
  hasError: z.boolean(),
  errorMessage: z.string().nullable(),
  isFilled: z.boolean(),
  valueType: z.string(),
  wouldBeValidIfSubmitted: z.boolean(),
});

// Form completion output schema
export const formCompletionOutputSchema = z.object({
  isComplete: z.boolean(),
  completionPercentage: z.number(),
  requiredFieldsStatus: z.object({
    firstName: z.boolean(),
    lastName: z.boolean(),
    email: z.boolean(),
  }),
  optionalFieldsStatus: z.object({
    age: z.boolean(),
    country: z.boolean(),
    message: z.boolean(),
    newsletter: z.boolean(),
  }),
  missingRequiredFields: z.array(z.string()),
  totalFields: z.number(),
  filledFields: z.number(),
});

// Form validation output schema
export const formValidationOutputSchema = z.object({
  isValid: z.boolean(),
  errors: z.record(z.string(), z.string()),
  errorCount: z.number(),
  validFields: z.array(z.string()),
  invalidFields: z.array(z.string()),
  fieldStatuses: z.record(
    z.string(),
    z.object({
      isValid: z.boolean(),
      error: z.string().optional(),
    }),
  ),
});

// Submit result output schema
export const submitFormOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errors: z.record(z.string(), z.string()).optional(),
  submittedData: z
    .object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      age: z.string(),
      country: z.string(),
      newsletter: z.boolean(),
      plan: z.string(),
      message: z.string(),
    })
    .optional(),
});

// Fill field result output schema
export const fillFieldOutputSchema = z.object({
  success: z.boolean(),
  fieldName: z.string(),
  newValue: z.union([z.string(), z.boolean()]),
  previousValue: z.union([z.string(), z.boolean()]),
  message: z.string(),
});

// Export JSON Schema versions for MCP tools
export const formStateOutputJsonSchema = formStateOutputSchema.toJSONSchema();
export const formAnalyticsOutputJsonSchema =
  formAnalyticsOutputSchema.toJSONSchema();
export const fieldInfoOutputJsonSchema = fieldInfoOutputSchema.toJSONSchema();
export const formCompletionOutputJsonSchema =
  formCompletionOutputSchema.toJSONSchema();
export const formValidationOutputJsonSchema =
  formValidationOutputSchema.toJSONSchema();
export const submitFormOutputJsonSchema = submitFormOutputSchema.toJSONSchema();
export const fillFieldOutputJsonSchema = fillFieldOutputSchema.toJSONSchema();
