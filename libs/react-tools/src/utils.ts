/**
 * Utility functions for working with MCP tools registry
 *
 * These functions provide direct access to the workerClient's tool registry information, allowing components to check which tools are currently registered and get details about them.
 * This is useful for debugging, monitoring, or displaying tool information in the UI.
 */

import { workerClient, type ToolDefinition } from '@mcp-fe/mcp-worker';

/**
 * Check if a tool is currently registered
 *
 * @param name - Tool name to check
 * @returns true if tool is registered, false otherwise
 */
export function isToolRegistered(name: string): boolean {
  return workerClient.isToolRegistered(name);
}

/**
 * Get list of all currently registered tool names
 *
 * @returns Array of registered tool names
 */
export function getRegisteredTools(): string[] {
  return workerClient.getRegisteredTools();
}

/**
 * Get basic registration information for a specific tool
 *
 * @param name - Tool name to query
 * @returns Object with refCount and isRegistered, or null if tool not found
 */
export function getToolInfo(
  name: string,
): { refCount: number; isRegistered: boolean } | null {
  return workerClient.getToolInfo(name);
}

/**
 * Get complete tool definition including description, schema, annotations, and metadata
 *
 * @param name - Tool name to query
 * @returns Full ToolDefinition with refCount and isRegistered, or null if tool not found
 */
export function getToolDetails(name: string):
  | (ToolDefinition & {
      refCount: number;
      isRegistered: boolean;
    })
  | null {
  return workerClient.getToolDetails(name);
}
