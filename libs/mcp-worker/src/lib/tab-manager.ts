/**
 * TabManager
 *
 * Manages browser tab tracking, active tab state, and tool registration per tab.
 * Provides intelligent routing logic for multi-tab scenarios.
 */

import { logger } from './logger';

export interface TabInfo {
  url: string;
  title: string;
  lastSeen: number;
}

export class TabManager {
  // Registry of all active tabs
  private tabRegistry = new Map<string, TabInfo>();

  // Currently active/focused tab
  private activeTabId: string | null = null;

  // Tool handlers per tab: Map<ToolName, Set<TabId>>
  private toolHandlersByTab = new Map<string, Set<string>>();

  /**
   * Register a new tab
   */
  public registerTab(tabId: string, url: string, title: string): void {
    if (!tabId) {
      logger.warn('[TabManager] Cannot register tab: missing tabId');
      return;
    }

    this.tabRegistry.set(tabId, {
      url: url || '',
      title: title || '',
      lastSeen: Date.now(),
    });

    logger.log(`[TabManager] Registered tab: ${tabId} (${title})`);
  }

  /**
   * Set the active/focused tab
   */
  public setActiveTab(tabId: string): void {
    if (!tabId) {
      logger.warn('[TabManager] Cannot set active tab: missing tabId');
      return;
    }

    this.activeTabId = tabId;
    logger.log(`[TabManager] Active tab changed: ${tabId}`);

    // Update lastSeen timestamp
    const tab = this.tabRegistry.get(tabId);
    if (tab) {
      tab.lastSeen = Date.now();
    }
  }

  /**
   * Get the currently active tab ID
   */
  public getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * Get all registered tabs
   */
  public getAllTabs(): Array<{ tabId: string } & TabInfo> {
    return Array.from(this.tabRegistry.entries()).map(([tabId, info]) => ({
      tabId,
      ...info,
    }));
  }

  /**
   * Get tab info by ID
   */
  public getTabInfo(tabId: string): TabInfo | undefined {
    return this.tabRegistry.get(tabId);
  }

  /**
   * Check if tab exists
   */
  public hasTab(tabId: string): boolean {
    return this.tabRegistry.has(tabId);
  }

  /**
   * Remove a tab from registry
   */
  public removeTab(tabId: string): boolean {
    const existed = this.tabRegistry.delete(tabId);

    if (existed) {
      logger.log(`[TabManager] Removed tab: ${tabId}`);

      // Clear active tab if it was removed
      if (this.activeTabId === tabId) {
        this.activeTabId = null;
      }

      // Clean up any tool registrations for this tab
      this.cleanupTabTools(tabId);
    }

    return existed;
  }

  /**
   * Register a tool for a specific tab
   */
  public registerToolForTab(toolName: string, tabId: string): boolean {
    if (!this.toolHandlersByTab.has(toolName)) {
      this.toolHandlersByTab.set(toolName, new Set());
    }

    const tabHandlers = this.toolHandlersByTab.get(toolName)!;
    const isNewTab = !tabHandlers.has(tabId);

    tabHandlers.add(tabId);

    if (isNewTab) {
      logger.log(
        `[TabManager] Tab ${tabId} registered tool '${toolName}' (${tabHandlers.size} tab(s) total)`,
      );
    } else {
      logger.log(
        `[TabManager] Tab ${tabId} re-registered tool '${toolName}' (already tracked)`,
      );
    }

    return isNewTab;
  }

  /**
   * Unregister a tool from a specific tab
   */
  public unregisterToolFromTab(
    toolName: string,
    tabId: string,
  ): {
    wasRemoved: boolean;
    remainingTabs: number;
    wasActiveTab: boolean;
  } {
    const tabHandlers = this.toolHandlersByTab.get(toolName);

    if (!tabHandlers || !tabHandlers.has(tabId)) {
      return { wasRemoved: false, remainingTabs: 0, wasActiveTab: false };
    }

    const wasActiveTab = tabId === this.activeTabId;
    tabHandlers.delete(tabId);

    const remainingTabs = tabHandlers.size;

    logger.log(
      `[TabManager] Removed tab ${tabId} from tool '${toolName}' (${remainingTabs} tab(s) remaining)`,
    );

    // Clean up empty set
    if (remainingTabs === 0) {
      this.toolHandlersByTab.delete(toolName);
    }

    return { wasRemoved: true, remainingTabs, wasActiveTab };
  }

  /**
   * Get all tabs that have a specific tool
   */
  public getTabsForTool(toolName: string): Set<string> {
    return this.toolHandlersByTab.get(toolName) || new Set();
  }

  /**
   * Check if a tab has a specific tool
   */
  public tabHasTool(toolName: string, tabId: string): boolean {
    const tabHandlers = this.toolHandlersByTab.get(toolName);
    return tabHandlers ? tabHandlers.has(tabId) : false;
  }

  /**
   * Smart routing: determine which tab should handle a tool call
   *
   * Priority:
   * 1. Explicit tabId parameter (if provided and valid)
   * 2. Only one tab has tool -> use it (regardless of focus)
   * 3. Active tab has tool -> use it
   * 4. Active tab doesn't have tool -> use first available
   * 5. No active tab -> use first available
   */
  public routeToolCall(
    toolName: string,
    explicitTabId?: string,
  ): {
    targetTabId: string;
    reason: string;
  } | null {
    const tabHandlers = this.toolHandlersByTab.get(toolName);

    if (!tabHandlers || tabHandlers.size === 0) {
      return null; // No tabs have this tool
    }

    // 1. Explicit tabId (if valid)
    if (explicitTabId) {
      if (tabHandlers.has(explicitTabId)) {
        return {
          targetTabId: explicitTabId,
          reason: 'explicit tabId parameter',
        };
      } else {
        // Invalid explicit tabId
        return null;
      }
    }

    // 2. Only one tab has this tool
    if (tabHandlers.size === 1) {
      const targetTabId = tabHandlers.values().next().value!;
      return {
        targetTabId,
        reason: 'only one tab has tool',
      };
    }

    // 3. Active tab has tool
    if (this.activeTabId && tabHandlers.has(this.activeTabId)) {
      return {
        targetTabId: this.activeTabId,
        reason: 'active tab has tool',
      };
    }

    // 4 & 5. Use first available tab
    const firstTab = tabHandlers.values().next().value!;
    const reason = this.activeTabId
      ? 'active tab lacks tool, using first available'
      : 'no active tab, using first available';

    return {
      targetTabId: firstTab,
      reason,
    };
  }

  /**
   * Get routing statistics for debugging
   */
  public getRoutingInfo(toolName: string): {
    toolExists: boolean;
    tabsWithTool: string[];
    activeTabHasTool: boolean;
    recommendedTab: string | null;
  } {
    const tabHandlers = this.toolHandlersByTab.get(toolName);
    const tabsWithTool = tabHandlers ? Array.from(tabHandlers) : [];

    return {
      toolExists: tabsWithTool.length > 0,
      tabsWithTool,
      activeTabHasTool: this.activeTabId
        ? this.tabHasTool(toolName, this.activeTabId)
        : false,
      recommendedTab: this.routeToolCall(toolName)?.targetTabId || null,
    };
  }

  /**
   * Clean up all tools for a specific tab
   * @private
   */
  private cleanupTabTools(tabId: string): void {
    const removedTools: string[] = [];

    for (const [toolName, tabHandlers] of this.toolHandlersByTab.entries()) {
      if (tabHandlers.has(tabId)) {
        tabHandlers.delete(tabId);
        removedTools.push(toolName);

        // Clean up empty sets
        if (tabHandlers.size === 0) {
          this.toolHandlersByTab.delete(toolName);
        }
      }
    }

    if (removedTools.length > 0) {
      logger.log(
        `[TabManager] Cleaned up ${removedTools.length} tool(s) for tab ${tabId}: ${removedTools.join(', ')}`,
      );
    }
  }

  /**
   * Get statistics for monitoring
   */
  public getStats(): {
    totalTabs: number;
    activeTabId: string | null;
    totalTools: number;
    toolsPerTab: Record<string, number>;
  } {
    const toolsPerTab: Record<string, number> = {};

    for (const [tabId] of this.tabRegistry) {
      let toolCount = 0;
      for (const tabHandlers of this.toolHandlersByTab.values()) {
        if (tabHandlers.has(tabId)) {
          toolCount++;
        }
      }
      toolsPerTab[tabId] = toolCount;
    }

    return {
      totalTabs: this.tabRegistry.size,
      activeTabId: this.activeTabId,
      totalTools: this.toolHandlersByTab.size,
      toolsPerTab,
    };
  }

  /**
   * Clear all data (for testing)
   */
  public clear(): void {
    this.tabRegistry.clear();
    this.activeTabId = null;
    this.toolHandlersByTab.clear();
    logger.log('[TabManager] Cleared all data');
  }
}
