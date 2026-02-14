/**
 * Type guard functions for runtime validation of tool arguments
 * These functions provide type-safe validation without requiring external libraries like Zod
 */

/**
 * Type guard for get_user_events tool arguments
 */
export function isGetUserEventsArgs(args: unknown): args is GetUserEventsArgs {
  if (!args || typeof args !== 'object') return true; // null/undefined is valid
  const obj = args as Record<string, unknown>;
  return (
    (obj['type'] === undefined ||
      ['navigation', 'click', 'input', 'custom'].includes(
        obj['type'] as string,
      )) &&
    (obj['startTime'] === undefined || typeof obj['startTime'] === 'number') &&
    (obj['endTime'] === undefined || typeof obj['endTime'] === 'number') &&
    (obj['path'] === undefined || typeof obj['path'] === 'string') &&
    (obj['limit'] === undefined || typeof obj['limit'] === 'number')
  );
}

/**
 * Type guard for get_navigation_history tool arguments
 */
export function isGetNavigationHistoryArgs(
  args: unknown,
): args is GetNavigationHistoryArgs {
  if (!args || typeof args !== 'object') return true;
  const obj = args as Record<string, unknown>;
  return obj['limit'] === undefined || typeof obj['limit'] === 'number';
}

/**
 * Type guard for get_click_events tool arguments
 */
export function isGetClickEventsArgs(
  args: unknown,
): args is GetClickEventsArgs {
  if (!args || typeof args !== 'object') return true;
  const obj = args as Record<string, unknown>;
  return (
    (obj['element'] === undefined || typeof obj['element'] === 'string') &&
    (obj['limit'] === undefined || typeof obj['limit'] === 'number')
  );
}

// Type definitions for tool arguments (exported for reuse)
export type GetUserEventsArgs = {
  type?: 'navigation' | 'click' | 'input' | 'custom';
  startTime?: number;
  endTime?: number;
  path?: string;
  limit?: number;
};

export type GetNavigationHistoryArgs = {
  limit?: number;
};

export type GetClickEventsArgs = {
  element?: string;
  limit?: number;
};
