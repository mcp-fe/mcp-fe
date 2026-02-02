/**
 * Jednoduchý pracovní příklad - Dynamická registrace MCP toolů
 *
 * Tento soubor můžete použít jako výchozí bod pro testování.
 */

import { WorkerClient } from '@mcp-fe/mcp-worker';

/**
 * Základní setup - zavolej tuto funkci při startu aplikace
 */
export async function setupMCPTools() {
  const client = new WorkerClient();

  // 1. Inicializace
  await client.init({
    backendWsUrl: 'ws://localhost:3001',
  });

  console.log('✅ MCP Worker initialized');

  // 2. Registrace základních toolů
  await registerBasicTools(client);

  console.log('✅ All tools registered');

  return client;
}

/**
 * Registrace základních toolů
 */
async function registerBasicTools(client: WorkerClient) {
  // Tool 1: Získání aktuálního času
  await client.registerTool(
    'get_current_time',
    'Get the current date and time',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      const now = new Date();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                timestamp: now.getTime(),
                iso: now.toISOString(),
                locale: now.toLocaleString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 2: Kalkulačka
  await client.registerTool(
    'calculate',
    'Perform basic arithmetic operations (add, subtract, multiply, divide)',
    {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The arithmetic operation to perform',
        },
        a: {
          type: 'number',
          description: 'First number',
        },
        b: {
          type: 'number',
          description: 'Second number',
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
                  text: JSON.stringify(
                    {
                      error: 'Division by zero is not allowed',
                    },
                    null,
                    2,
                  ),
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
                text: JSON.stringify(
                  {
                    error: `Unknown operation: ${operation}`,
                  },
                  null,
                  2,
                ),
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
                a,
                b,
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

  // Tool 3: Získání informací o stránce
  await client.registerTool(
    'get_page_info',
    'Get information about the current page',
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
                title: document.title,
                url: window.location.href,
                referrer: document.referrer || 'none',
                language: navigator.language,
                userAgent: navigator.userAgent,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 4: LocalStorage operace
  await client.registerTool(
    'get_local_storage',
    'Get values from localStorage',
    {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description:
            'The localStorage key to retrieve (optional, returns all if omitted)',
        },
      },
    },
    async (args: any) => {
      const { key } = args || {};

      if (key) {
        const value = localStorage.getItem(key);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  key,
                  value,
                  found: value !== null,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Vrátit všechny klíče
      const all: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          all[k] = localStorage.getItem(k);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: localStorage.length,
                items: all,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  console.log('  ✓ get_current_time');
  console.log('  ✓ calculate');
  console.log('  ✓ get_page_info');
  console.log('  ✓ get_local_storage');
}

/**
 * Příklad s pokročilými features (Zod validace, fetch API)
 *
 * Odkomentuj pro použití (vyžaduje: npm install zod)
 */
/*
import { z } from 'zod';

export async function registerAdvancedTools(client: WorkerClient) {
  // Tool s Zod validací
  await client.registerTool(
    'validate_email',
    'Validate an email address using Zod',
    {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address to validate',
        },
      },
      required: ['email'],
    },
    async (args: any) => {
      const schema = z.object({
        email: z.string().email(),
      });

      try {
        const validated = schema.parse(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                valid: true,
                email: validated.email,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                valid: false,
                error: error instanceof z.ZodError
                  ? error.errors[0].message
                  : 'Validation failed',
              }, null, 2),
            },
          ],
        };
      }
    },
  );

  // Tool s fetch API
  await client.registerTool(
    'fetch_github_user',
    'Fetch GitHub user information',
    {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'GitHub username',
        },
      },
      required: ['username'],
    },
    async (args: any) => {
      const { username } = args;

      try {
        const response = await fetch(
          `https://api.github.com/users/${username}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                login: data.login,
                name: data.name,
                bio: data.bio,
                publicRepos: data.public_repos,
                followers: data.followers,
                following: data.following,
                avatarUrl: data.avatar_url,
                htmlUrl: data.html_url,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to fetch user',
                username,
              }, null, 2),
            },
          ],
        };
      }
    },
  );

  console.log('  ✓ validate_email');
  console.log('  ✓ fetch_github_user');
}
*/

/**
 * Příklad použití v React komponentě
 */
/*
import { useEffect } from 'react';

export function MyApp() {
  useEffect(() => {
    setupMCPTools()
      .then(() => console.log('MCP Tools ready!'))
      .catch(console.error);
  }, []);

  return <div>App is running with MCP Tools</div>;
}
*/

/**
 * Příklad použití v plain JavaScript/TypeScript
 */
/*
// main.ts nebo index.ts
import { setupMCPTools } from './mcp-tools-setup';

async function main() {
  const client = await setupMCPTools();

  // Tools jsou nyní dostupné přes MCP protokol
  // Připojte se pomocí MCP clienta (např. Claude Desktop) na ws://localhost:3001

  console.log('🎉 Application ready with MCP Tools!');
}

main().catch(console.error);
*/
