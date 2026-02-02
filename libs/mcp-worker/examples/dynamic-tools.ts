/**
 * Dynamic MCP Tool Registration Examples
 *
 * This file demonstrates advanced patterns for registering custom MCP tools
 * from your client application without modifying worker code.
 *
 * Examples included:
 * 1. Simple tool without parameters (get_current_time)
 * 2. Tool with parameters and validation (calculate)
 * 3. Tool with async operations (get_weather with fetch)
 * 4. Tool with inline validation (create_user)
 *
 * Key Features Demonstrated:
 * - Full access to browser APIs (fetch, Date, etc.)
 * - Parameter validation and error handling
 * - Async operations and external API calls
 * - Custom validation logic
 * - Proper error responses
 *
 * Related Files:
 * - quick-start-example.ts - Simpler ready-to-use examples
 * - ../docs/guide.md - Complete documentation
 * - ../docs/architecture.md - Architecture details
 *
 * @see {@link https://github.com/your-org/mcp-fe/blob/main/libs/mcp-worker/docs/guide.md}
 */

// Note: When using in your app, import from the package:
// import { workerClient } from '@mcp-fe/mcp-worker';
//
// This example uses direct import for demonstration:
import { WorkerClient } from '../src/lib/worker-client';

// Initialize the worker client
async function initializeWorkerClient() {
  const client = new WorkerClient();

  await client.init({
    backendWsUrl: 'ws://localhost:3001',
  });

  return client;
}

// Example 1: Simple tool without parameters
// Demonstrates basic tool structure and JSON response
async function registerSimpleTool(client: WorkerClient) {
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
            text: JSON.stringify(
              {
                timestamp: Date.now(),
                iso: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  console.log('✓ Registered tool: get_current_time');
}

// Example 2: Tool with parameters
// Demonstrates input validation and error handling
async function registerCalculatorTool(client: WorkerClient) {
  await client.registerTool(
    'calculate',
    'Perform basic arithmetic operations',
    {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The operation to perform',
        },
        a: {
          type: 'number',
          description: 'First operand',
        },
        b: {
          type: 'number',
          description: 'Second operand',
        },
      },
      required: ['operation', 'a', 'b'],
    },
    async (args: any) => {
      const { operation, a, b } = args;

      let result: number;

      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Division by zero' }, null, 2),
                },
              ],
            };
          }
          result = a / b;
          break;
        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Invalid operation' }, null, 2),
              },
            ],
          };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                operation,
                operands: { a, b },
                result,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  console.log('✓ Registered tool: calculate');
}

// Example 3: Tool with async operations (fetch)
// Demonstrates HTTP requests and external API integration
async function registerWeatherTool(client: WorkerClient) {
  await client.registerTool(
    'get_weather',
    'Get weather information for a city',
    {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name',
        },
      },
      required: ['city'],
    },
    async (args: any) => {
      const { city } = args;

      try {
        // Note: In real usage, you would use a proper API key
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=YOUR_API_KEY`,
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  city: data.name,
                  temperature: data.main.temp,
                  description: data.weather[0].description,
                  humidity: data.main.humidity,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Failed to fetch weather data',
                  message:
                    error instanceof Error ? error.message : 'Unknown error',
                  city,
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );

  console.log('✓ Registered tool: get_weather');
}

// Example 4: Tool with inline validation
// Demonstrates custom validation logic and error accumulation
async function registerUserTool(client: WorkerClient) {
  await client.registerTool(
    'create_user',
    'Create a new user with validation',
    {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Username (3-20 characters)',
          minLength: 3,
          maxLength: 20,
        },
        email: {
          type: 'string',
          description: 'Email address',
          format: 'email',
        },
        age: {
          type: 'number',
          description: 'User age',
          minimum: 18,
          maximum: 120,
        },
      },
      required: ['username', 'email', 'age'],
    },
    async (args: any) => {
      const { username, email, age } = args;

      // Additional custom validation
      const errors: string[] = [];

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errors.push(
          'Username can only contain letters, numbers, and underscores',
        );
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format');
      }

      if (age < 18 || age > 120) {
        errors.push('Age must be between 18 and 120');
      }

      if (errors.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  errors,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Simulate user creation
      const userId = Math.random().toString(36).substring(7);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                user: {
                  id: userId,
                  username,
                  email,
                  age,
                  createdAt: new Date().toISOString(),
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  console.log('✓ Registered tool: create_user');
}

// Unregister a tool
async function unregisterTool(client: WorkerClient, toolName: string) {
  const success = await client.unregisterTool(toolName);

  if (success) {
    console.log(`✓ Unregistered tool: ${toolName}`);
  } else {
    console.log(`✗ Tool not found: ${toolName}`);
  }

  return success;
}

// Main function for demonstration
async function main() {
  console.log('🚀 Starting MCP Dynamic Tools Example...\n');

  // 1. Initialize
  const client = await initializeWorkerClient();
  console.log('✓ Worker client initialized\n');

  // 2. Register tools
  console.log('Registering tools...');
  await registerSimpleTool(client);
  await registerCalculatorTool(client);
  await registerWeatherTool(client);
  await registerUserTool(client);
  console.log('\n✓ All tools registered successfully!\n');

  // 3. Tools are now available via MCP protocol
  console.log('Tools are now available via MCP protocol.');
  console.log('You can test them using an MCP client.\n');

  // 4. Optional: Demonstrate unregistration
  // await unregisterTool(client, 'get_current_time');
}

// Export for use in your application
export {
  initializeWorkerClient,
  registerSimpleTool,
  registerCalculatorTool,
  registerWeatherTool,
  registerUserTool,
  unregisterTool,
};

// Run demo if executed directly
if (typeof window !== 'undefined') {
  main().catch(console.error);
}
