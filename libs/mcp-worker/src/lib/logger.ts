/**
 * Logger utility for MCP Worker
 *
 * Respects NODE_ENV environment variable:
 * - production: Only errors are logged
 * - development: All logs are enabled
 *
 * Can be overridden by setting MCP_DEBUG=true/false
 */

// Check if debug logging is enabled
const isProduction =
  typeof process !== 'undefined' && process.env?.['NODE_ENV'] === 'production';
const mcpDebug = typeof process !== 'undefined' && process.env?.['MCP_DEBUG'];
const debugEnabled =
  mcpDebug === 'true' || (!isProduction && mcpDebug !== 'false');

export const logger = {
  log: (...args: unknown[]) => {
    if (debugEnabled) {
      console.log(...args);
    }
  },

  debug: (...args: unknown[]) => {
    if (debugEnabled) {
      console.debug(...args);
    }
  },

  info: (...args: unknown[]) => {
    // Always log info messages, even in production
    console.info(...args);
  },

  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(...args);
  },

  warn: (...args: unknown[]) => {
    if (debugEnabled) {
      console.warn(...args);
    }
  },
};
