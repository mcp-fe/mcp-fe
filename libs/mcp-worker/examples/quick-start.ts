/**
 * Quick Start Examples for MCP Dynamic Tool Registration
 *
 * This file contains simple, ready-to-use examples perfect for getting started.
 * Copy these examples into your application and modify them as needed.
 *
 * Examples included:
 * 1. get_current_time - Simple tool without parameters
 * 2. get_user_info - Tool accessing application state
 * 3. list_items - Tool returning structured data
 * 4. simple_echo - Basic input/output example
 *
 * Usage:
 * ```typescript
 * import { workerClient } from '@mcp-fe/mcp-worker';
 *
 * await workerClient.init({ backendWsUrl: 'ws://localhost:3001' });
 * await registerGetCurrentTime(workerClient);
 * ```
 *
 * Related Files:
 * - dynamic-tools.ts - Advanced examples with validation
 * - ../docs/guide.md - Complete documentation
 * - ../../react-event-tracker/src/examples/ - React examples
 */

// Note: When using in your app, import from the package:
// import { workerClient } from '@mcp-fe/mcp-worker';
//
// This example uses direct import for demonstration:
import type { WorkerClient } from '../src/lib/worker-client';

/**
 * Example 1: Simple tool without parameters
 * Returns current timestamp - demonstrates basic tool structure
 */
export async function registerGetCurrentTime(client: WorkerClient) {
  await client.registerTool(
    'get_current_time',
    'Get the current server time',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              timestamp: Date.now(),
              iso: new Date().toISOString(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          },
        ],
      };
    },
  );

  console.log('✓ Registered: get_current_time');
}

/**
 * Example 2: Tool accessing application state
 * Demonstrates how handler can access external data/state
 */
export async function registerGetUserInfo(client: WorkerClient) {
  // Simulate getting current user from your app state
  const getCurrentUser = () => ({
    id: '123',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
  });

  await client.registerTool(
    'get_user_info',
    'Get information about the currently logged-in user',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      const user = getCurrentUser(); // Full access to your application!

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
              },
              fetchedAt: new Date().toISOString(),
            }),
          },
        ],
      };
    },
  );

  console.log('✓ Registered: get_user_info');
}

/**
 * Example 3: Tool returning structured data
 * Shows how to return lists/arrays of data
 */
export async function registerListItems(client: WorkerClient) {
  await client.registerTool(
    'list_items',
    'Get a list of items',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      // Could fetch from database, API, or local state
      const items = [
        { id: 1, name: 'Item 1', status: 'active' },
        { id: 2, name: 'Item 2', status: 'pending' },
        { id: 3, name: 'Item 3', status: 'completed' },
      ];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              items,
              total: items.length,
              timestamp: Date.now(),
            }),
          },
        ],
      };
    },
  );

  console.log('✓ Registered: list_items');
}

/**
 * Example 4: Simple echo tool with input
 * Demonstrates basic parameter handling
 */
export async function registerSimpleEcho(client: WorkerClient) {
  await client.registerTool(
    'simple_echo',
    'Echo back the provided message',
    {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo back',
        },
      },
      required: ['message'],
    },
    async (args: any) => {
      const { message } = args;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              echo: message,
              length: message.length,
              uppercase: message.toUpperCase(),
              receivedAt: new Date().toISOString(),
            }),
          },
        ],
      };
    },
  );

  console.log('✓ Registered: simple_echo');
}
