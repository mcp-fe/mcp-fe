/**
 * Příklad použití dynamické registrace MCP toolů
 *
 * Tento soubor demonstruje, jak registrovat vlastní MCP tooly
 * z klientské aplikace bez modifikace worker kódu.
 */

import { WorkerClient } from '@mcp-fe/mcp-worker';

// Inicializace worker clienta
async function initializeWorkerClient() {
  const client = new WorkerClient();

  await client.init({
    backendWsUrl: 'ws://localhost:3001',
  });

  return client;
}

// Příklad 1: Jednoduchý tool bez parametrů
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

// Příklad 2: Tool s parametry
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

// Příklad 3: Tool s async operací (fetch)
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
        // Poznámka: V reálném použití byste použili správné API
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

// Příklad 4: Tool s validací pomocí inline validace
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

      // Dodatečná validace
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

      // Simulace vytvoření uživatele
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

// Odregistrace toolu
async function unregisterTool(client: WorkerClient, toolName: string) {
  const success = await client.unregisterTool(toolName);

  if (success) {
    console.log(`✓ Unregistered tool: ${toolName}`);
  } else {
    console.log(`✗ Tool not found: ${toolName}`);
  }

  return success;
}

// Hlavní funkce pro demonstraci
async function main() {
  console.log('🚀 Starting MCP Dynamic Tools Example...\n');

  // 1. Inicializace
  const client = await initializeWorkerClient();
  console.log('✓ Worker client initialized\n');

  // 2. Registrace toolů
  console.log('Registering tools...');
  await registerSimpleTool(client);
  await registerCalculatorTool(client);
  await registerWeatherTool(client);
  await registerUserTool(client);
  console.log('\n✓ All tools registered successfully!\n');

  // 3. Čekání (tooly jsou nyní dostupné přes MCP protokol)
  console.log('Tools are now available via MCP protocol.');
  console.log('You can test them using an MCP client.\n');

  // 4. Demonstrace odregistrace (volitelné)
  // await unregisterTool(client, 'get_current_time');
}

// Export pro použití v aplikaci
export {
  initializeWorkerClient,
  registerSimpleTool,
  registerCalculatorTool,
  registerWeatherTool,
  registerUserTool,
  unregisterTool,
};

// Spuštění ukázky (pokud je soubor spuštěn přímo)
if (typeof window !== 'undefined') {
  main().catch(console.error);
}
