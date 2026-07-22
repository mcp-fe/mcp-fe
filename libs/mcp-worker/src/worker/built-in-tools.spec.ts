jest.mock('../shared/database', () => ({
  queryEvents: jest.fn(),
}));

import { registerBuiltInTools, registerTabManagementTool } from './built-in-tools';
import { toolRegistry } from './tool-registry';
import { queryEvents } from '../shared/database';
import { TabManager } from './tab-manager';

describe('built-in-tools', () => {
  beforeEach(() => {
    toolRegistry.clear();
    (queryEvents as jest.Mock).mockReset().mockResolvedValue([]);
  });

  describe('registerBuiltInTools', () => {
    it('registers all three event-tracking tools', () => {
      registerBuiltInTools();
      expect(toolRegistry.getTools().map((t) => t.name).sort()).toEqual([
        'get_click_events',
        'get_navigation_history',
        'get_user_events',
      ]);
    });

    describe('get_user_events handler', () => {
      it('queries with the given filters and returns them as JSON text content', async () => {
        registerBuiltInTools();
        const events = [{ id: '1', type: 'click', timestamp: 1 }];
        (queryEvents as jest.Mock).mockResolvedValue(events);

        const handler = toolRegistry.getHandler('get_user_events')!;
        const result = await handler({ type: 'click', limit: 10 });

        expect(queryEvents).toHaveBeenCalledWith({
          type: 'click',
          startTime: undefined,
          endTime: undefined,
          path: undefined,
          limit: 10,
        });
        expect(JSON.parse(result.content[0].text)).toEqual({ events });
      });

      it('defaults limit to 100 when not provided', async () => {
        registerBuiltInTools();
        const handler = toolRegistry.getHandler('get_user_events')!;
        await handler({});
        expect(queryEvents).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 100 }),
        );
      });

      it('throws for invalid (non-object) arguments', async () => {
        registerBuiltInTools();
        const handler = toolRegistry.getHandler('get_user_events')!;
        await expect(handler('not-an-object')).rejects.toThrow(
          'Invalid arguments for get_user_events',
        );
      });
    });

    describe('get_navigation_history handler', () => {
      it('queries type=navigation with a default limit of 50', async () => {
        registerBuiltInTools();
        const handler = toolRegistry.getHandler('get_navigation_history')!;
        await handler({});
        expect(queryEvents).toHaveBeenCalledWith({ type: 'navigation', limit: 50 });
      });

      it('maps events into the navigationHistory shape', async () => {
        registerBuiltInTools();
        (queryEvents as jest.Mock).mockResolvedValue([
          { id: '1', type: 'navigation', timestamp: 1, from: '/a', to: '/b', path: '/b' },
        ]);
        const handler = toolRegistry.getHandler('get_navigation_history')!;
        const result = await handler({});

        expect(JSON.parse(result.content[0].text)).toEqual({
          navigationHistory: [{ from: '/a', to: '/b', path: '/b', timestamp: 1 }],
        });
      });

      it('throws for invalid arguments', async () => {
        registerBuiltInTools();
        const handler = toolRegistry.getHandler('get_navigation_history')!;
        await expect(handler({ limit: 'nope' })).rejects.toThrow(
          'Invalid arguments for get_navigation_history',
        );
      });
    });

    describe('get_click_events handler', () => {
      it('queries type=click and filters client-side by element/text/id/class', async () => {
        registerBuiltInTools();
        (queryEvents as jest.Mock).mockResolvedValue([
          { id: '1', type: 'click', timestamp: 1, element: 'button', elementText: 'Submit' },
          { id: '2', type: 'click', timestamp: 2, element: 'a', elementText: 'Cancel' },
        ]);
        const handler = toolRegistry.getHandler('get_click_events')!;
        const result = await handler({ element: 'submit' });

        expect(queryEvents).toHaveBeenCalledWith({ type: 'click', limit: 100 });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.clickEvents).toHaveLength(1);
        expect(parsed.clickEvents[0].elementText).toBe('Submit');
      });

      it('returns everything unfiltered when no element filter is given', async () => {
        registerBuiltInTools();
        (queryEvents as jest.Mock).mockResolvedValue([
          { id: '1', type: 'click', timestamp: 1, element: 'button' },
          { id: '2', type: 'click', timestamp: 2, element: 'a' },
        ]);
        const handler = toolRegistry.getHandler('get_click_events')!;
        const result = await handler({});

        expect(JSON.parse(result.content[0].text).clickEvents).toHaveLength(2);
      });

      it('throws for invalid arguments', async () => {
        registerBuiltInTools();
        const handler = toolRegistry.getHandler('get_click_events')!;
        await expect(handler({ limit: 'nope' })).rejects.toThrow(
          'Invalid arguments for get_click_events',
        );
      });
    });
  });

  describe('registerTabManagementTool', () => {
    it('registers list_browser_tabs reflecting the given TabManager', async () => {
      const tabManager = new TabManager();
      tabManager.registerTab('tab-1', 'https://example.com', 'Example');
      tabManager.setActiveTab('tab-1');

      registerTabManagementTool(tabManager);
      const handler = toolRegistry.getHandler('list_browser_tabs')!;
      const result = await handler({});

      const tabs = JSON.parse(result.content[0].text);
      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toMatchObject({ tabId: 'tab-1', isActive: true });
    });

    it('marks non-active tabs accordingly', async () => {
      const tabManager = new TabManager();
      tabManager.registerTab('tab-1', 'https://a.com', 'A');
      tabManager.registerTab('tab-2', 'https://b.com', 'B');
      tabManager.setActiveTab('tab-1');

      registerTabManagementTool(tabManager);
      const handler = toolRegistry.getHandler('list_browser_tabs')!;
      const tabs = JSON.parse((await handler({})).content[0].text);

      const tab2 = tabs.find((t: any) => t.tabId === 'tab-2');
      expect(tab2.isActive).toBe(false);
    });
  });
});
