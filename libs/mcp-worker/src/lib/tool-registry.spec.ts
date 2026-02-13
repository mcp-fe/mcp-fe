import { ToolRegistry, ToolDefinition, ToolHandler } from './tool-registry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Tool Registration', () => {
    it('should register a new tool', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
        },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef, handler);

      const tools = registry.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
      expect(tools[0].description).toBe('A test tool');
    });

    it('should register multiple tools', () => {
      const toolDef1: ToolDefinition = {
        name: 'tool-1',
        inputSchema: { type: 'object' },
      };

      const toolDef2: ToolDefinition = {
        name: 'tool-2',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);
      registry.register(toolDef2, handler);

      const tools = registry.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual(['tool-1', 'tool-2']);
    });

    it('should throw error when registering tool with duplicate name', () => {
      const toolDef1: ToolDefinition = {
        name: 'test-tool',
        description: 'Original description',
        inputSchema: { type: 'object' },
      };

      const toolDef2: ToolDefinition = {
        name: 'test-tool',
        description: 'Updated description',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);

      expect(() => registry.register(toolDef2, handler)).toThrow(
        "Tool 'test-tool' is already registered. Use update() to modify an existing tool.",
      );

      // Original tool should remain unchanged
      const tools = registry.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('Original description');
    });

    it('should register tool with all optional fields', () => {
      const toolDef: ToolDefinition = {
        name: 'complex-tool',
        description: 'A complex tool',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        annotations: {
          title: 'Complex Tool',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        execution: {
          taskSupport: 'optional',
        },
        _meta: {
          customField: 'customValue',
        },
        icons: [
          {
            src: 'icon.png',
            mimeType: 'image/png',
            sizes: ['16x16', '32x32'],
            theme: 'light',
          },
        ],
        title: 'Complex Tool',
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef, handler);

      const tools = registry.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('complex-tool');
      expect(tools[0].annotations?.readOnlyHint).toBe(true);
      expect(tools[0].execution?.taskSupport).toBe('optional');
      expect(tools[0]._meta?.['customField']).toBe('customValue');
      expect(tools[0].icons).toHaveLength(1);
      expect(tools[0].icons?.[0].src).toBe('icon.png');
    });
  });

  describe('Tool Update', () => {
    it('should update existing tool definition', () => {
      const toolDef1: ToolDefinition = {
        name: 'test-tool',
        description: 'Original description',
        inputSchema: { type: 'object' },
      };

      const toolDef2: ToolDefinition = {
        name: 'test-tool',
        description: 'Updated description',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);
      registry.update(toolDef2, handler);

      const tools = registry.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('Updated description');
    });

    it('should update existing tool handler', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        inputSchema: { type: 'object' },
      };

      const handler1: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'original' }],
      });

      const handler2: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'updated' }],
      });

      registry.register(toolDef, handler1);
      registry.update(toolDef, handler2);

      const handler = registry.getHandler('test-tool');
      expect(handler).toBe(handler2);
    });

    it('should throw error when updating non-existent tool', () => {
      const toolDef: ToolDefinition = {
        name: 'non-existent',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      expect(() => registry.update(toolDef, handler)).toThrow(
        "Tool 'non-existent' not found. Use register() to add a new tool.",
      );
    });

    it('should update only the specified tool', () => {
      const toolDef1: ToolDefinition = {
        name: 'tool-1',
        description: 'Tool 1',
        inputSchema: { type: 'object' },
      };

      const toolDef2: ToolDefinition = {
        name: 'tool-2',
        description: 'Tool 2',
        inputSchema: { type: 'object' },
      };

      const toolDef2Updated: ToolDefinition = {
        name: 'tool-2',
        description: 'Tool 2 Updated',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);
      registry.register(toolDef2, handler);
      registry.update(toolDef2Updated, handler);

      const tools = registry.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.find((t) => t.name === 'tool-1')?.description).toBe(
        'Tool 1',
      );
      expect(tools.find((t) => t.name === 'tool-2')?.description).toBe(
        'Tool 2 Updated',
      );
    });

    it('should allow updating tool multiple times', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register({ ...toolDef, description: 'v1' }, handler);
      registry.update({ ...toolDef, description: 'v2' }, handler);
      registry.update({ ...toolDef, description: 'v3' }, handler);

      const tools = registry.getTools();
      expect(tools[0].description).toBe('v3');
    });
  });

  describe('Tool Unregistration', () => {
    it('should unregister an existing tool', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef, handler);
      expect(registry.getTools()).toHaveLength(1);

      const result = registry.unregister('test-tool');
      expect(result).toBe(true);
      expect(registry.getTools()).toHaveLength(0);
      expect(registry.getHandler('test-tool')).toBeUndefined();
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should unregister only specified tool', () => {
      const toolDef1: ToolDefinition = {
        name: 'tool-1',
        inputSchema: { type: 'object' },
      };

      const toolDef2: ToolDefinition = {
        name: 'tool-2',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);
      registry.register(toolDef2, handler);

      registry.unregister('tool-1');

      const tools = registry.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('tool-2');
    });
  });

  describe('Get Tools', () => {
    it('should return empty array when no tools registered', () => {
      const tools = registry.getTools();
      expect(tools).toEqual([]);
    });

    it('should return all registered tools', () => {
      const toolDef1: ToolDefinition = {
        name: 'tool-1',
        inputSchema: { type: 'object' },
      };

      const toolDef2: ToolDefinition = {
        name: 'tool-2',
        inputSchema: { type: 'object' },
      };

      const toolDef3: ToolDefinition = {
        name: 'tool-3',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);
      registry.register(toolDef2, handler);
      registry.register(toolDef3, handler);

      const tools = registry.getTools();
      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toContain('tool-1');
      expect(tools.map((t) => t.name)).toContain('tool-2');
      expect(tools.map((t) => t.name)).toContain('tool-3');
    });

    it('should return a new array on each call', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef, handler);

      const tools1 = registry.getTools();
      const tools2 = registry.getTools();

      expect(tools1).not.toBe(tools2);
      expect(tools1).toEqual(tools2);
    });
  });

  describe('Get Handler', () => {
    it('should return handler for registered tool', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async (args) => ({
        content: [{ type: 'text', text: `processed: ${JSON.stringify(args)}` }],
      });

      registry.register(toolDef, handler);

      const retrievedHandler = registry.getHandler('test-tool');
      expect(retrievedHandler).toBe(handler);
    });

    it('should return undefined for non-existent tool', () => {
      const handler = registry.getHandler('non-existent');
      expect(handler).toBeUndefined();
    });

    it('should return correct handler after update', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        inputSchema: { type: 'object' },
      };

      const handler1: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'handler1' }],
      });

      const handler2: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'handler2' }],
      });

      registry.register(toolDef, handler1);
      registry.update(toolDef, handler2);

      const retrievedHandler = registry.getHandler('test-tool');
      expect(retrievedHandler).toBe(handler2);
    });

    it('should execute handler correctly', async () => {
      const toolDef: ToolDefinition = {
        name: 'echo-tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async (args: unknown) => ({
        content: [{ type: 'text', text: `echo: ${JSON.stringify(args)}` }],
      });

      registry.register(toolDef, handler);

      const retrievedHandler = registry.getHandler('echo-tool');
      expect(retrievedHandler).toBeDefined();

      if (!retrievedHandler) return;
      const result = await retrievedHandler({ message: 'hello' });
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('echo: {"message":"hello"}');
    });
  });

  describe('Clear', () => {
    it('should clear all tools and handlers', () => {
      const toolDef1: ToolDefinition = {
        name: 'tool-1',
        inputSchema: { type: 'object' },
      };

      const toolDef2: ToolDefinition = {
        name: 'tool-2',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);
      registry.register(toolDef2, handler);

      expect(registry.getTools()).toHaveLength(2);

      registry.clear();

      expect(registry.getTools()).toHaveLength(0);
      expect(registry.getHandler('tool-1')).toBeUndefined();
      expect(registry.getHandler('tool-2')).toBeUndefined();
    });

    it('should allow registration after clear', () => {
      const toolDef1: ToolDefinition = {
        name: 'tool-1',
        inputSchema: { type: 'object' },
      };

      const toolDef2: ToolDefinition = {
        name: 'tool-2',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);
      registry.clear();
      registry.register(toolDef2, handler);

      const tools = registry.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('tool-2');
    });

    it('should not throw when clearing empty registry', () => {
      expect(() => registry.clear()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle tool with empty description', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        description: '',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef, handler);

      const tools = registry.getTools();
      expect(tools[0].description).toBe('');
    });

    it('should handle tool without description', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef, handler);

      const tools = registry.getTools();
      expect(tools[0].description).toBeUndefined();
    });

    it('should handle complex input schema', () => {
      const toolDef: ToolDefinition = {
        name: 'complex-tool',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
            },
            age: {
              type: 'number',
              minimum: 0,
              maximum: 150,
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
            metadata: {
              type: 'object',
              additionalProperties: true,
            },
          },
          required: ['name'],
        },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef, handler);

      const tools = registry.getTools();
      expect(tools[0].inputSchema).toEqual(toolDef.inputSchema);
    });

    it('should handle handler that returns multiple content items', async () => {
      const toolDef: ToolDefinition = {
        name: 'multi-content-tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [
          { type: 'text', text: 'First result' },
          { type: 'text', text: 'Second result' },
          { type: 'text', text: 'Third result' },
        ],
      });

      registry.register(toolDef, handler);

      const retrievedHandler = registry.getHandler('multi-content-tool');
      if (!retrievedHandler) return;
      const result = await retrievedHandler({});

      expect(result.content).toHaveLength(3);
      expect(result.content[0].text).toBe('First result');
      expect(result.content[1].text).toBe('Second result');
      expect(result.content[2].text).toBe('Third result');
    });

    it('should handle handler that throws error', async () => {
      const toolDef: ToolDefinition = {
        name: 'error-tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => {
        throw new Error('Handler error');
      };

      registry.register(toolDef, handler);

      const retrievedHandler = registry.getHandler('error-tool');
      if (!retrievedHandler) return;
      await expect(retrievedHandler({})).rejects.toThrow('Handler error');
    });

    it('should handle all annotation hints', () => {
      const toolDef: ToolDefinition = {
        name: 'annotated-tool',
        inputSchema: { type: 'object' },
        annotations: {
          title: 'Annotated Tool',
          readOnlyHint: true,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef, handler);

      const tools = registry.getTools();
      expect(tools[0].annotations?.title).toBe('Annotated Tool');
      expect(tools[0].annotations?.readOnlyHint).toBe(true);
      expect(tools[0].annotations?.destructiveHint).toBe(true);
      expect(tools[0].annotations?.idempotentHint).toBe(false);
      expect(tools[0].annotations?.openWorldHint).toBe(true);
    });

    it('should handle all execution task support values', () => {
      const toolDef1: ToolDefinition = {
        name: 'optional-task',
        inputSchema: { type: 'object' },
        execution: { taskSupport: 'optional' },
      };

      const toolDef2: ToolDefinition = {
        name: 'required-task',
        inputSchema: { type: 'object' },
        execution: { taskSupport: 'required' },
      };

      const toolDef3: ToolDefinition = {
        name: 'forbidden-task',
        inputSchema: { type: 'object' },
        execution: { taskSupport: 'forbidden' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register(toolDef1, handler);
      registry.register(toolDef2, handler);
      registry.register(toolDef3, handler);

      const tools = registry.getTools();
      expect(
        tools.find((t) => t.name === 'optional-task')?.execution?.taskSupport,
      ).toBe('optional');
      expect(
        tools.find((t) => t.name === 'required-task')?.execution?.taskSupport,
      ).toBe('required');
      expect(
        tools.find((t) => t.name === 'forbidden-task')?.execution?.taskSupport,
      ).toBe('forbidden');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: register, retrieve, execute, unregister', async () => {
      const toolDef: ToolDefinition = {
        name: 'workflow-tool',
        description: 'A tool for workflow testing',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async (args) => ({
        content: [{ type: 'text', text: `Processed: ${JSON.stringify(args)}` }],
      });

      // Register
      registry.register(toolDef, handler);
      expect(registry.getTools()).toHaveLength(1);

      // Retrieve and execute
      const retrievedHandler = registry.getHandler('workflow-tool');
      expect(retrievedHandler).toBeDefined();

      if (!retrievedHandler) return;
      const result = await retrievedHandler({ test: 'data' });
      expect(result.content[0].text).toBe('Processed: {"test":"data"}');

      // Unregister
      const unregistered = registry.unregister('workflow-tool');
      expect(unregistered).toBe(true);
      expect(registry.getTools()).toHaveLength(0);
    });

    it('should handle multiple tools with different handlers', async () => {
      const addHandler: ToolHandler = async (args: unknown) => ({
        content: [
          {
            type: 'text',
            text: String(
              (args as { a: number; b: number }).a +
                (args as { a: number; b: number }).b,
            ),
          },
        ],
      });

      const multiplyHandler: ToolHandler = async (args: unknown) => ({
        content: [
          {
            type: 'text',
            text: String(
              (args as { a: number; b: number }).a *
                (args as { a: number; b: number }).b,
            ),
          },
        ],
      });

      registry.register(
        { name: 'add', inputSchema: { type: 'object' } },
        addHandler,
      );

      registry.register(
        { name: 'multiply', inputSchema: { type: 'object' } },
        multiplyHandler,
      );

      const add = registry.getHandler('add');
      const multiply = registry.getHandler('multiply');

      if (!add || !multiply) return;
      const addResult = await add({ a: 5, b: 3 });
      const multiplyResult = await multiply({ a: 5, b: 3 });

      expect(addResult.content[0].text).toBe('8');
      expect(multiplyResult.content[0].text).toBe('15');
    });
  });
});
