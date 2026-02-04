/**
 * TabManager Unit Tests
 */

import { TabManager } from './tab-manager';

describe('TabManager', () => {
  let tabManager: TabManager;

  beforeEach(() => {
    tabManager = new TabManager();
  });

  describe('Tab Registration', () => {
    it('should register a new tab', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');

      const tabs = tabManager.getAllTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].tabId).toBe('tab-1');
      expect(tabs[0].url).toBe('/dashboard');
      expect(tabs[0].title).toBe('Dashboard');
    });

    it('should update existing tab on re-registration', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-1', '/settings', 'Settings');

      const tabs = tabManager.getAllTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].url).toBe('/settings');
      expect(tabs[0].title).toBe('Settings');
    });

    it('should register multiple tabs', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/settings', 'Settings');

      const tabs = tabManager.getAllTabs();
      expect(tabs).toHaveLength(2);
    });

    it('should not register tab without tabId', () => {
      tabManager.registerTab('', '/dashboard', 'Dashboard');

      const tabs = tabManager.getAllTabs();
      expect(tabs).toHaveLength(0);
    });
  });

  describe('Active Tab Management', () => {
    it('should set active tab', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.setActiveTab('tab-1');

      expect(tabManager.getActiveTabId()).toBe('tab-1');
    });

    it('should update active tab', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/settings', 'Settings');

      tabManager.setActiveTab('tab-1');
      expect(tabManager.getActiveTabId()).toBe('tab-1');

      tabManager.setActiveTab('tab-2');
      expect(tabManager.getActiveTabId()).toBe('tab-2');
    });

    it('should return null when no active tab', () => {
      expect(tabManager.getActiveTabId()).toBeNull();
    });

    it('should update lastSeen when setting active tab', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');

      const before = Date.now();
      tabManager.setActiveTab('tab-1');
      const after = Date.now();

      const tabInfo = tabManager.getTabInfo('tab-1');
      expect(tabInfo?.lastSeen).toBeGreaterThanOrEqual(before);
      expect(tabInfo?.lastSeen).toBeLessThanOrEqual(after);
    });
  });

  describe('Tab Removal', () => {
    it('should remove tab', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');

      const removed = tabManager.removeTab('tab-1');

      expect(removed).toBe(true);
      expect(tabManager.getAllTabs()).toHaveLength(0);
    });

    it('should return false when removing non-existent tab', () => {
      const removed = tabManager.removeTab('non-existent');
      expect(removed).toBe(false);
    });

    it('should clear active tab when removing it', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.setActiveTab('tab-1');

      tabManager.removeTab('tab-1');

      expect(tabManager.getActiveTabId()).toBeNull();
    });

    it('should clean up tools when removing tab', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerToolForTab('tool-1', 'tab-1');

      tabManager.removeTab('tab-1');

      expect(tabManager.tabHasTool('tool-1', 'tab-1')).toBe(false);
      expect(tabManager.getTabsForTool('tool-1').size).toBe(0);
    });
  });

  describe('Tool Registration', () => {
    beforeEach(() => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/settings', 'Settings');
    });

    it('should register tool for tab', () => {
      const isNew = tabManager.registerToolForTab('get_data', 'tab-1');

      expect(isNew).toBe(true);
      expect(tabManager.tabHasTool('get_data', 'tab-1')).toBe(true);
    });

    it('should return false when re-registering same tool for same tab', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      const isNew = tabManager.registerToolForTab('get_data', 'tab-1');

      expect(isNew).toBe(false);
    });

    it('should register same tool for multiple tabs', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.registerToolForTab('get_data', 'tab-2');

      const tabs = tabManager.getTabsForTool('get_data');
      expect(tabs.size).toBe(2);
      expect(tabs.has('tab-1')).toBe(true);
      expect(tabs.has('tab-2')).toBe(true);
    });

    it('should track multiple tools per tab', () => {
      tabManager.registerToolForTab('tool-1', 'tab-1');
      tabManager.registerToolForTab('tool-2', 'tab-1');

      expect(tabManager.tabHasTool('tool-1', 'tab-1')).toBe(true);
      expect(tabManager.tabHasTool('tool-2', 'tab-1')).toBe(true);
    });
  });

  describe('Tool Unregistration', () => {
    beforeEach(() => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/settings', 'Settings');
    });

    it('should unregister tool from tab', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');

      const result = tabManager.unregisterToolFromTab('get_data', 'tab-1');

      expect(result.wasRemoved).toBe(true);
      expect(result.remainingTabs).toBe(0);
      expect(tabManager.tabHasTool('get_data', 'tab-1')).toBe(false);
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = tabManager.unregisterToolFromTab('non-existent', 'tab-1');

      expect(result.wasRemoved).toBe(false);
      expect(result.remainingTabs).toBe(0);
    });

    it('should track remaining tabs after unregistration', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.registerToolForTab('get_data', 'tab-2');

      const result = tabManager.unregisterToolFromTab('get_data', 'tab-1');

      expect(result.wasRemoved).toBe(true);
      expect(result.remainingTabs).toBe(1);
      expect(tabManager.tabHasTool('get_data', 'tab-2')).toBe(true);
    });

    it('should detect when active tab unregisters tool', () => {
      tabManager.setActiveTab('tab-1');
      tabManager.registerToolForTab('get_data', 'tab-1');

      const result = tabManager.unregisterToolFromTab('get_data', 'tab-1');

      expect(result.wasActiveTab).toBe(true);
    });

    it('should clean up empty tool sets', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.unregisterToolFromTab('get_data', 'tab-1');

      const tabs = tabManager.getTabsForTool('get_data');
      expect(tabs.size).toBe(0);
    });
  });

  describe('Smart Routing', () => {
    beforeEach(() => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/settings', 'Settings');
      tabManager.registerTab('tab-3', '/profile', 'Profile');
    });

    it('should route with explicit tabId', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.registerToolForTab('get_data', 'tab-2');

      const route = tabManager.routeToolCall('get_data', 'tab-2');

      expect(route).not.toBeNull();
      expect(route?.targetTabId).toBe('tab-2');
      expect(route?.reason).toBe('explicit tabId parameter');
    });

    it('should return null for invalid explicit tabId', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');

      const route = tabManager.routeToolCall('get_data', 'invalid-tab');

      expect(route).toBeNull();
    });

    it('should route to only tab with tool', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');

      const route = tabManager.routeToolCall('get_data');

      expect(route).not.toBeNull();
      expect(route?.targetTabId).toBe('tab-1');
      expect(route?.reason).toBe('only one tab has tool');
    });

    it('should prefer active tab when multiple tabs have tool', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.registerToolForTab('get_data', 'tab-2');
      tabManager.setActiveTab('tab-2');

      const route = tabManager.routeToolCall('get_data');

      expect(route).not.toBeNull();
      expect(route?.targetTabId).toBe('tab-2');
      expect(route?.reason).toBe('active tab has tool');
    });

    it('should route to first available when active tab lacks tool', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.registerToolForTab('get_data', 'tab-2');
      tabManager.setActiveTab('tab-3'); // Active tab doesn't have tool

      const route = tabManager.routeToolCall('get_data');

      expect(route).not.toBeNull();
      expect(route?.targetTabId).toBe('tab-1');
      expect(route?.reason).toBe(
        'active tab lacks tool, using first available',
      );
    });

    it('should route to first available when no active tab', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.registerToolForTab('get_data', 'tab-2');

      const route = tabManager.routeToolCall('get_data');

      expect(route).not.toBeNull();
      expect(route?.targetTabId).toBe('tab-1');
      expect(route?.reason).toBe('no active tab, using first available');
    });

    it('should return null when no tabs have tool', () => {
      const route = tabManager.routeToolCall('non-existent-tool');

      expect(route).toBeNull();
    });
  });

  describe('Routing Info', () => {
    beforeEach(() => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/settings', 'Settings');
    });

    it('should provide routing info for existing tool', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.setActiveTab('tab-1');

      const info = tabManager.getRoutingInfo('get_data');

      expect(info.toolExists).toBe(true);
      expect(info.tabsWithTool).toEqual(['tab-1']);
      expect(info.activeTabHasTool).toBe(true);
      expect(info.recommendedTab).toBe('tab-1');
    });

    it('should indicate when tool does not exist', () => {
      const info = tabManager.getRoutingInfo('non-existent');

      expect(info.toolExists).toBe(false);
      expect(info.tabsWithTool).toEqual([]);
      expect(info.activeTabHasTool).toBe(false);
      expect(info.recommendedTab).toBeNull();
    });

    it('should detect when active tab lacks tool', () => {
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.setActiveTab('tab-2');

      const info = tabManager.getRoutingInfo('get_data');

      expect(info.activeTabHasTool).toBe(false);
      expect(info.recommendedTab).toBe('tab-1');
    });
  });

  describe('Statistics', () => {
    it('should provide accurate stats', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/settings', 'Settings');
      tabManager.setActiveTab('tab-1');

      tabManager.registerToolForTab('tool-1', 'tab-1');
      tabManager.registerToolForTab('tool-2', 'tab-1');
      tabManager.registerToolForTab('tool-2', 'tab-2');

      const stats = tabManager.getStats();

      expect(stats.totalTabs).toBe(2);
      expect(stats.activeTabId).toBe('tab-1');
      expect(stats.totalTools).toBe(2);
      expect(stats.toolsPerTab['tab-1']).toBe(2);
      expect(stats.toolsPerTab['tab-2']).toBe(1);
    });

    it('should handle empty state', () => {
      const stats = tabManager.getStats();

      expect(stats.totalTabs).toBe(0);
      expect(stats.activeTabId).toBeNull();
      expect(stats.totalTools).toBe(0);
      expect(stats.toolsPerTab).toEqual({});
    });
  });

  describe('Clear', () => {
    it('should clear all data', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.setActiveTab('tab-1');
      tabManager.registerToolForTab('get_data', 'tab-1');

      tabManager.clear();

      expect(tabManager.getAllTabs()).toHaveLength(0);
      expect(tabManager.getActiveTabId()).toBeNull();
      expect(tabManager.getTabsForTool('get_data').size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle hasTab check', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');

      expect(tabManager.hasTab('tab-1')).toBe(true);
      expect(tabManager.hasTab('non-existent')).toBe(false);
    });

    it('should return undefined for non-existent tab info', () => {
      const info = tabManager.getTabInfo('non-existent');
      expect(info).toBeUndefined();
    });

    it('should handle empty tool name', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerToolForTab('', 'tab-1');

      expect(tabManager.tabHasTool('', 'tab-1')).toBe(true);
    });

    it('should handle multiple unregistrations of same tool', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerToolForTab('get_data', 'tab-1');

      const result1 = tabManager.unregisterToolFromTab('get_data', 'tab-1');
      expect(result1.wasRemoved).toBe(true);

      const result2 = tabManager.unregisterToolFromTab('get_data', 'tab-1');
      expect(result2.wasRemoved).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle navigation scenario', () => {
      // Setup: Two tabs with same tool
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/dashboard', 'Dashboard');
      tabManager.registerToolForTab('get_metrics', 'tab-1');
      tabManager.registerToolForTab('get_metrics', 'tab-2');
      tabManager.setActiveTab('tab-1');

      // Tab 1 navigates away (unregisters tool)
      tabManager.unregisterToolFromTab('get_metrics', 'tab-1');

      // Routing should adapt to tab 2
      const route = tabManager.routeToolCall('get_metrics');
      expect(route?.targetTabId).toBe('tab-2');
      expect(route?.reason).toBe('only one tab has tool');
    });

    it('should handle all tabs closing scenario', () => {
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerTab('tab-2', '/dashboard', 'Dashboard');
      tabManager.registerToolForTab('get_data', 'tab-1');
      tabManager.registerToolForTab('get_data', 'tab-2');

      // Both tabs close
      tabManager.unregisterToolFromTab('get_data', 'tab-1');
      tabManager.unregisterToolFromTab('get_data', 'tab-2');

      // Tool should be completely gone
      const route = tabManager.routeToolCall('get_data');
      expect(route).toBeNull();
    });

    it('should handle tab re-opening with tools', () => {
      // Tab opens, registers tool
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerToolForTab('get_data', 'tab-1');

      // Tab closes (removes tab)
      tabManager.removeTab('tab-1');

      // Tab re-opens (same ID from sessionStorage)
      tabManager.registerTab('tab-1', '/dashboard', 'Dashboard');
      tabManager.registerToolForTab('get_data', 'tab-1');

      // Should work normally
      const route = tabManager.routeToolCall('get_data');
      expect(route?.targetTabId).toBe('tab-1');
    });
  });
});
