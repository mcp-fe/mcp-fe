/**
 * Structured Output Example
 *
 * This file demonstrates the use of outputSchema for structured tool outputs.
 * When outputSchema is defined, the tool returns JSON text that MCPController
 * automatically parses and adds as structuredContent alongside the text content.
 *
 * Examples included:
 * 1. Tool with outputSchema - returns text that becomes structured
 * 2. Tool without outputSchema - returns serialized text (legacy behavior)
 *
 * Related Files:
 * - dynamic-tools.ts - More tool registration examples
 * - ../docs/structured-output.md - Complete documentation
 */

import { WorkerClient } from '../src/client/worker-client';

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
    async (args: unknown) => {
      const { userId } = args as { userId: string };

      // Simulate fetching user data
      const userData = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        createdAt: new Date().toISOString(),
      };

      // With outputSchema, return as JSON text
      // MCPController will automatically parse this and add structuredContent
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(userData),
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
  console.log(
    '  → Returns both content (text) and structuredContent (parsed object)',
  );
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

      // Without outputSchema, returns only text content
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
  console.log('  → Returns only content (text), no structuredContent');
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
    async (args: unknown) => {
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

      // Return as JSON text - MCPController parses it for structuredContent
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analyticsData),
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
  console.log(
    '  → MCPController adds structuredContent with parsed nested objects',
  );
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('Structured Output Example - MCP Worker');
  console.log('='.repeat(60));
  console.log('\nInitializing MCP Worker Client...');
  const client = await initializeWorkerClient();

  console.log('\nRegistering tools with different output formats...\n');

  // Register all example tools
  await registerStructuredUserTool(client);
  await registerLegacyUserTool(client);
  await registerAnalyticsTool(client);

  console.log('\n' + '='.repeat(60));
  console.log('✓ All tools registered successfully!');
  console.log('='.repeat(60));

  console.log('\n📋 How it works:');
  console.log('');
  console.log('1. WITH outputSchema:');
  console.log(
    '   Handler returns: { content: [{ type: "text", text: JSON.stringify(data) }] }',
  );
  console.log('   MCPController adds: structuredContent: <parsed JSON object>');
  console.log('   AI receives: BOTH text and structured versions');
  console.log('');
  console.log('2. WITHOUT outputSchema:');
  console.log(
    '   Handler returns: { content: [{ type: "text", text: "..." }] }',
  );
  console.log('   MCPController sends: Only text content');
  console.log('   AI receives: Just the text string');
  console.log('');
  console.log('📖 See docs/structured-output.md for complete documentation');
  console.log('');
}

// Run the example
if (typeof window !== 'undefined') {
  main().catch(console.error);
}

export { main, initializeWorkerClient };
