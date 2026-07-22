jest.mock('../shared/logger', () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createMCPServer, notifyToolsChanged, mcpServer } from './mcp-server';
import { toolRegistry } from './tool-registry';

/** Connects a real SDK Client to `server` over an in-memory transport pair. */
async function connectClient(server: Server): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return client;
}

describe('mcp-server.ts', () => {
  beforeEach(() => {
    toolRegistry.clear();
  });

  describe('createMCPServer', () => {
    it('registers built-in tools by default', () => {
      createMCPServer();
      expect(toolRegistry.getTools().map((t) => t.name).sort()).toEqual([
        'get_click_events',
        'get_navigation_history',
        'get_user_events',
      ]);
    });

    it('skips built-in tools when autoRegisterBuiltInTools is false', () => {
      createMCPServer({ autoRegisterBuiltInTools: false });
      expect(toolRegistry.getTools()).toEqual([]);
    });

    it('lists whatever is currently in the registry via tools/list', async () => {
      toolRegistry.register(
        { name: 'custom_tool', inputSchema: { type: 'object', properties: {} } },
        async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      );
      const server = createMCPServer({ autoRegisterBuiltInTools: false });
      const client = await connectClient(server);

      const result = await client.listTools();
      expect(result.tools.map((t) => t.name)).toEqual(['custom_tool']);

      await client.close();
    });

    it('invokes the registered handler for tools/call and returns its result', async () => {
      const handler = jest
        .fn()
        .mockResolvedValue({ content: [{ type: 'text', text: 'hello' }] });
      toolRegistry.register(
        { name: 'echo', inputSchema: { type: 'object', properties: {} } },
        handler,
      );
      const server = createMCPServer({ autoRegisterBuiltInTools: false });
      const client = await connectClient(server);

      const result = await client.callTool({ name: 'echo', arguments: { foo: 'bar' } });

      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
      expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);

      await client.close();
    });

    it('rejects tools/call for an unknown tool name', async () => {
      const server = createMCPServer({ autoRegisterBuiltInTools: false });
      const client = await connectClient(server);

      await expect(
        client.callTool({ name: 'does_not_exist', arguments: {} }),
      ).rejects.toThrow();

      await client.close();
    });
  });

  describe('notifyToolsChanged', () => {
    it('does not throw when the server has no connected transport', () => {
      const server = createMCPServer({ autoRegisterBuiltInTools: false });
      expect(() => notifyToolsChanged(server)).not.toThrow();
    });

    it('delivers a tools/list_changed notification to a connected client', async () => {
      const server = createMCPServer({ autoRegisterBuiltInTools: false });
      const client = await connectClient(server);
      const received = new Promise<void>((resolve) => {
        client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
          resolve();
        });
      });

      notifyToolsChanged(server);
      await received;

      await client.close();
    });
  });

  describe('mcpServer singleton', () => {
    it('is a defined Server instance', () => {
      expect(mcpServer).toBeDefined();
    });
  });
});
