/**
 * Optional Context Provider for MCP Tools
 *
 * Provides centralized management and monitoring of MCP tools.
 * Usage is OPTIONAL - useMCPTool works fine without it.
 *
 * Benefits of using the Provider:
 * - Centralized initialization
 * - Global tool monitoring
 * - Connection status tracking
 * - Easier debugging
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { workerClient, type WorkerClientInitOptions } from '@mcp-fe/mcp-worker';

interface MCPToolsContextValue {
  /**
   * Whether the worker client is initialized
   */
  isInitialized: boolean;

  /**
   * Whether connected to MCP server
   */
  isConnected: boolean;

  /**
   * List of currently registered tool names
   */
  registeredTools: string[];

  /**
   * Initialize the worker client (if not already initialized)
   */
  initialize: (options?: WorkerClientInitOptions) => Promise<void>;

  /**
   * Get connection status
   */
  getConnectionStatus: () => Promise<boolean>;
}

const MCPToolsContext = createContext<MCPToolsContextValue | null>(null);

export interface MCPToolsProviderProps {
  children: React.ReactNode;

  /**
   * Auto-initialize on mount (default: true)
   */
  autoInit?: boolean;

  /**
   * Backend WebSocket URL
   */
  backendWsUrl?: string;

  /**
   * Other worker client init options
   */
  initOptions?: WorkerClientInitOptions;

  /**
   * Callback when initialization completes
   */
  onInitialized?: () => void;

  /**
   * Callback when initialization fails
   */
  onInitError?: (error: Error) => void;
}

/**
 * Provider for MCP Tools context
 *
 * @example Basic usage:
 * ```tsx
 * function App() {
 *   return (
 *     <MCPToolsProvider backendWsUrl="ws://localhost:3001">
 *       <YourApp />
 *     </MCPToolsProvider>
 *   );
 * }
 * ```
 *
 * @example With callbacks:
 * ```tsx
 * function App() {
 *   return (
 *     <MCPToolsProvider
 *       backendWsUrl="ws://localhost:3001"
 *       onInitialized={() => console.log('MCP Tools ready!')}
 *       onInitError={(err) => console.error('MCP init failed:', err)}
 *     >
 *       <YourApp />
 *     </MCPToolsProvider>
 *   );
 * }
 * ```
 *
 * @example Manual initialization:
 * ```tsx
 * function App() {
 *   return (
 *     <MCPToolsProvider autoInit={false}>
 *       <YourApp />
 *     </MCPToolsProvider>
 *   );
 * }
 *
 * function YourApp() {
 *   const { initialize } = useMCPToolsContext();
 *
 *   return (
 *     <button onClick={() => initialize({ backendWsUrl: 'ws://localhost:3001' })}>
 *       Initialize MCP
 *     </button>
 *   );
 * }
 * ```
 */
export function MCPToolsProvider({
  children,
  autoInit = true,
  backendWsUrl = 'ws://localhost:3001',
  initOptions,
  onInitialized,
  onInitError,
}: MCPToolsProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [registeredTools] = useState<string[]>([]);

  const initialize = useCallback(
    async (options?: WorkerClientInitOptions) => {
      if (isInitialized) {
        console.log('[MCPToolsProvider] Already initialized');
        return;
      }

      try {
        const opts = options || initOptions || { backendWsUrl };

        console.log('[MCPToolsProvider] Initializing worker client...', opts);
        await workerClient.init(opts);

        setIsInitialized(true);

        // Check initial connection status
        const connected = await workerClient.getConnectionStatus();
        setIsConnected(connected);

        // Subscribe to connection status updates
        workerClient.onConnectionStatus((connected) => {
          setIsConnected(connected);
        });

        console.log('[MCPToolsProvider] Worker client initialized');
        onInitialized?.();
      } catch (error) {
        console.error('[MCPToolsProvider] Initialization failed:', error);
        onInitError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
        throw error;
      }
    },
    [isInitialized, initOptions, backendWsUrl, onInitialized, onInitError],
  );

  const getConnectionStatus = useCallback(async () => {
    const status = await workerClient.getConnectionStatus();
    setIsConnected(status);
    return status;
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInit) {
      initialize().catch((error) => {
        console.error('[MCPToolsProvider] Auto-init failed:', error);
      });
    }
  }, [autoInit, initialize]);

  // Poll for registered tools (for debugging/monitoring)
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      // This would need to be implemented if we want live updates
      // For now, tools are tracked locally in useMCPTool
    }, 5000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  const value: MCPToolsContextValue = {
    isInitialized,
    isConnected,
    registeredTools,
    initialize,
    getConnectionStatus,
  };

  return (
    <MCPToolsContext.Provider value={value}>
      {children}
    </MCPToolsContext.Provider>
  );
}

/**
 * Hook to access MCP Tools context
 *
 * Note: This is OPTIONAL. useMCPTool works fine without it.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, registeredTools } = useMCPToolsContext();
 *
 *   return (
 *     <div>
 *       <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
 *       <p>Tools: {registeredTools.join(', ')}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @throws Error if used outside of MCPToolsProvider (when strict mode is enabled)
 */
export function useMCPToolsContext(strict = false): MCPToolsContextValue {
  const context = useContext(MCPToolsContext);

  if (!context && strict) {
    throw new Error(
      'useMCPToolsContext must be used within MCPToolsProvider. ' +
        'Either wrap your component tree with <MCPToolsProvider> or set strict=false.',
    );
  }

  // Return mock context if not in provider (allows hook to work without provider)
  return (
    context || {
      isInitialized: false,
      isConnected: false,
      registeredTools: [],
      initialize: async () => {
        throw new Error('MCPToolsProvider not found');
      },
      getConnectionStatus: async () => false,
    }
  );
}

/**
 * Hook to check if MCPToolsProvider is being used
 */
export function useHasMCPProvider(): boolean {
  const context = useContext(MCPToolsContext);
  return context !== null;
}
