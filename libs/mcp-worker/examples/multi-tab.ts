/**
 * Multi-Tab Example
 *
 * Demonstrates how multi-tab support works with intelligent routing.
 *
 * Run this example:
 * 1. Open multiple browser tabs with your app
 * 2. Each tab registers the same tool
 * 3. AI can target specific tabs or use the focused tab
 */

// Note: When using in your app, import from the package:
// import { workerClient } from '@mcp-fe/mcp-worker';
//
// This example uses direct import for demonstration:
import { WorkerClient } from '../src/lib/worker-client';

/**
 * Example 1: Basic Multi-Tab Tool
 *
 * This tool works across multiple tabs automatically.
 * Without tabId parameter → uses focused tab
 * With tabId parameter → targets specific tab
 */
async function example1_BasicMultiTab(client: WorkerClient) {
  // Register a tool that returns current page info
  await client.registerTool(
    'get_current_page',
    'Get information about the current page (URL, title). Works across multiple tabs - uses focused tab by default, or specify tabId to target specific tab.',
    {
      type: 'object',
      properties: {},
      // NOTE: tabId parameter is added automatically!
    },
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              url: window.location.href,
              title: document.title,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };
    },
  );

  console.log('✓ Tool registered: get_current_page');
  console.log('  - No tabId param → uses focused tab');
  console.log('  - With tabId → targets specific tab');
}

/**
 * Example 2: Using Built-in Tab Discovery
 *
 * Use list_browser_tabs to discover available tabs
 */
async function example2_TabDiscovery(client: WorkerClient) {
  // Get current tab info
  const tabInfo = client.getTabInfo();
  console.log('Current tab:', tabInfo);
  // → { tabId: "abc-123", isActive: true, url: "/page", title: "Page" }

  // AI can discover tabs using built-in tool:
  // list_browser_tabs()
  // → Returns array of all active tabs with IDs, URLs, titles

  console.log('✓ Built-in tool available: list_browser_tabs');
  console.log(
    '  Use it to discover available tabs before targeting specific ones',
  );
}

/**
 * Example 3: Multi-Tab with Different States
 *
 * Each tab can have different state, worker routes correctly
 */
async function example3_DifferentStates(client: WorkerClient) {
  // Simulate different state per tab
  const tabState = {
    tabId: client.getTabId(),
    data: `Tab-specific data ${Math.random()}`,
  };

  await client.registerTool(
    'get_tab_state',
    'Get state from this tab. Each tab has independent state.',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tabState),
          },
        ],
      };
    },
  );

  console.log('✓ Tool registered with tab-specific state');
  console.log('  Each tab will return different data');
}

/**
 * Example 4: Cross-Tab Comparison
 *
 * AI can compare data across multiple tabs
 */
async function example4_CrossTabComparison(client: WorkerClient) {
  await client.registerTool(
    'get_performance_metrics',
    'Get performance metrics from current page',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              loadTime,
              domReady:
                timing.domContentLoadedEventEnd - timing.navigationStart,
              url: window.location.href,
            }),
          },
        ],
      };
    },
  );

  console.log('✓ AI can now compare performance across tabs:');
  console.log('  1. list_browser_tabs() → get all tab IDs');
  console.log('  2. get_performance_metrics({ tabId: "tab1" })');
  console.log('  3. get_performance_metrics({ tabId: "tab2" })');
  console.log('  4. Compare results');
}

/**
 * Example 5: Focus-Driven Debugging
 *
 * Natural debugging workflow using focused tab
 */
async function example5_FocusDrivenDebugging(client: WorkerClient) {
  await client.registerTool(
    'debug_current_view',
    'Debug the currently visible tab (automatically uses focused tab)',
    {
      type: 'object',
      properties: {},
    },
    async () => {
      const debugInfo = {
        url: window.location.href,
        title: document.title,
        tabId: client.getTabId(),
        isActive: client.getTabInfo().isActive,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        scroll: {
          x: window.scrollX,
          y: window.scrollY,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(debugInfo, null, 2),
          },
        ],
      };
    },
  );

  console.log('✓ Natural debugging workflow:');
  console.log('  User: "Debug this page"');
  console.log('  AI: debug_current_view() → automatically uses focused tab');
}

export {
  example1_BasicMultiTab,
  example2_TabDiscovery,
  example3_DifferentStates,
  example4_CrossTabComparison,
  example5_FocusDrivenDebugging,
};
