jest.mock('../shared/logger', () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { ToolRegistry, toolRegistry } from './tool-registry';
import { logger } from '../shared/logger';
import type { ToolDefinition, ToolHandler } from '../shared/types';

function makeDefinition(name: string): ToolDefinition {
  return { name, description: `desc for ${name}`, inputSchema: { type: 'object', properties: {} } };
}

function makeHandler(): ToolHandler {
  return jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
}

describe('ToolRegistry (worker-side)', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    (logger.warn as jest.Mock).mockClear();
  });

  it('registers a tool so it is retrievable via getTools/getHandler', () => {
    const handler = makeHandler();
    registry.register(makeDefinition('tool-a'), handler);

    expect(registry.getTools()).toEqual([makeDefinition('tool-a')]);
    expect(registry.getHandler('tool-a')).toBe(handler);
  });

  it('getHandler/getTools reflect multiple registered tools', () => {
    registry.register(makeDefinition('tool-a'), makeHandler());
    registry.register(makeDefinition('tool-b'), makeHandler());

    expect(registry.getTools().map((t) => t.name).sort()).toEqual(['tool-a', 'tool-b']);
  });

  it('getHandler returns undefined for an unknown tool', () => {
    expect(registry.getHandler('unknown')).toBeUndefined();
  });

  it('silently overwrites a tool registered under the same name, without warning the first time', () => {
    const handlerA = makeHandler();
    registry.register(makeDefinition('tool-a'), handlerA);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when a second register() call overwrites an already-registered tool', () => {
    const handlerA = makeHandler();
    const handlerB = makeHandler();
    registry.register(makeDefinition('tool-a'), handlerA);
    registry.register(makeDefinition('tool-a'), handlerB);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Overwriting already-registered tool 'tool-a'"),
    );
    // The later registration wins.
    expect(registry.getHandler('tool-a')).toBe(handlerB);
    expect(registry.getTools()).toHaveLength(1);
  });

  it('unregister removes both the definition and handler, returning true', () => {
    registry.register(makeDefinition('tool-a'), makeHandler());
    expect(registry.unregister('tool-a')).toBe(true);
    expect(registry.getHandler('tool-a')).toBeUndefined();
    expect(registry.getTools()).toEqual([]);
  });

  it('unregister returns false for a tool that was never registered', () => {
    expect(registry.unregister('unknown')).toBe(false);
  });

  it('clear() empties both tools and handlers', () => {
    registry.register(makeDefinition('tool-a'), makeHandler());
    registry.register(makeDefinition('tool-b'), makeHandler());

    registry.clear();

    expect(registry.getTools()).toEqual([]);
    expect(registry.getHandler('tool-a')).toBeUndefined();
    expect(registry.getHandler('tool-b')).toBeUndefined();
  });

  it('exports a shared singleton instance', () => {
    expect(toolRegistry).toBeInstanceOf(ToolRegistry);
  });
});
