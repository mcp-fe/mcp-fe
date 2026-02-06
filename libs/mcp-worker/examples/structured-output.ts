/**
 * Structured Output Example
 *
 * This file demonstrates the use of outputSchema for structured tool outputs.
 * When outputSchema is defined, the tool returns structured data instead of
 * serialized text, allowing AI models to better understand and work with the results.
 *
 * Examples included:
 * 1. Tool with outputSchema - returns structured data
 * 2. Tool without outputSchema - returns serialized text (legacy behavior)
 *
 * Related Files:
 * - dynamic-tools.ts - More tool registration examples
 * - ../docs/guide.md - Complete documentation
 */

import { WorkerClient } from '../src/lib/worker-client';

// Initialize the worker client
async function initializeWorkerClient() {
  const client = new WorkerClient();

  await client.init({
    backendWsUrl: 'ws://localhost:3001',
  });

  return client;
}

// Example 1: Tool WITH outputSchema - returns structured data
async function registerStructuredUserTool(client: WorkerClient) {
  await client.registerTool(
    'get_user_data',
    'Get structured user data',
    {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to fetch',
        },
      },
      required: ['userId'],
    },
    async (
      args: unknown,
    ): Promise<{
      content: Array<
        | { type: string; text: string }
        | { type: string; resource?: Record<string, unknown> }
      >;
    }> => {
      const { userId } = args as { userId: string };

      // Simulate fetching user data
      const userData = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        createdAt: new Date().toISOString(),
      };

      // With outputSchema, return structured data
      // The MCPController will handle this as structured output
      return {
        content: [
          {
            type: 'resource',
            resource: userData,
          },
        ],
      };
    },
    {
      // Define outputSchema for structured response
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          createdAt: { type: 'string' },
        },
        required: ['id', 'name', 'email'],
      },
      annotations: {
        title: 'Get User Data',
        readOnlyHint: true,
      },
    },
  );

  console.log('✓ Registered tool with outputSchema: get_user_data');
}

// Example 2: Tool WITHOUT outputSchema - returns serialized text (legacy)
async function registerLegacyUserTool(client: WorkerClient) {
  await client.registerTool(
    'get_user_legacy',
    'Get user data (legacy text format)',
    {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to fetch',
        },
      },
      required: ['userId'],
    },
    async (args: unknown) => {
      const { userId } = args as { userId: string };

      // Simulate fetching user data
      const userData = {
        id: userId,
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'user',
      };

      // Without outputSchema, this will be serialized to text
      // The MCPController will convert this to JSON string
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(userData, null, 2),
          },
        ],
      };
    },
    {
      // No outputSchema - legacy behavior
      annotations: {
        title: 'Get User (Legacy)',
        readOnlyHint: true,
      },
    },
  );

  console.log('✓ Registered tool without outputSchema: get_user_legacy');
}

// Example 3: Complex structured output with nested objects
async function registerAnalyticsTool(client: WorkerClient) {
  await client.registerTool(
    'get_analytics',
    'Get website analytics with structured data',
    {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'Time period for analytics',
        },
      },
      required: ['period'],
    },
    async (
      args: unknown,
    ): Promise<{
      content: Array<
        | { type: string; text: string }
        | { type: string; resource?: Record<string, unknown> }
      >;
    }> => {
      const { period } = args as { period: string };

      // Simulate fetching analytics data
      const analyticsData = {
        period,
        summary: {
          totalVisits: 15420,
          uniqueVisitors: 8930,
          pageViews: 45230,
          avgSessionDuration: 245,
        },
        topPages: [
          { path: '/home', views: 8500 },
          { path: '/products', views: 5200 },
          { path: '/about', views: 3100 },
        ],
        conversions: {
          signups: 342,
          purchases: 156,
          rate: 0.034,
        },
        timestamp: new Date().toISOString(),
      };

      // Return as structured data
      return {
        content: [
          {
            type: 'resource',
            resource: analyticsData,
          },
        ],
      };
    },
    {
      outputSchema: {
        type: 'object',
        properties: {
          period: { type: 'string' },
          summary: {
            type: 'object',
            properties: {
              totalVisits: { type: 'number' },
              uniqueVisitors: { type: 'number' },
              pageViews: { type: 'number' },
              avgSessionDuration: { type: 'number' },
            },
          },
          topPages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                views: { type: 'number' },
              },
            },
          },
          conversions: {
            type: 'object',
            properties: {
              signups: { type: 'number' },
              purchases: { type: 'number' },
              rate: { type: 'number' },
            },
          },
          timestamp: { type: 'string' },
        },
        required: ['period', 'summary', 'topPages', 'conversions'],
      },
      annotations: {
        title: 'Website Analytics',
        readOnlyHint: true,
      },
    },
  );

  console.log('✓ Registered complex structured tool: get_analytics');
}

// Main execution
async function main() {
  console.log('Initializing MCP Worker Client...');
  const client = await initializeWorkerClient();

  console.log('\nRegistering tools with different output formats...\n');

  // Register all example tools
  await registerStructuredUserTool(client);
  await registerLegacyUserTool(client);
  await registerAnalyticsTool(client);

  console.log('\n✓ All tools registered successfully!');
  console.log('\nKey Differences:');
  console.log(
    '- get_user_data: Uses outputSchema → returns structured data (resource)',
  );
  console.log('- get_user_legacy: No outputSchema → returns serialized text');
  console.log(
    '- get_analytics: Complex outputSchema → returns nested structured data',
  );
  console.log(
    '\nThe AI model can now better understand and work with structured outputs!',
  );
}

// Run the example
if (typeof window !== 'undefined') {
  main().catch(console.error);
}

export { main, initializeWorkerClient };
