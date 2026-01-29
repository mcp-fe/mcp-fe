import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WebSocket } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Session Manager - handles session state and message queueing
 * Tracks active sessions, server-initiated messages, connection state, and WebSocket references
 */

export interface SessionState {
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  isWSConnected: boolean;
  transport?: StreamableHTTPServerTransport;
  ws?: WebSocket;
  mcpServer?: Server;
  pendingMessages: any[];
  pendingRequests: Map<string, { id: string; createdAt: number }>;
}

export class SessionManager {
  private sessions = new Map<string, SessionState>();
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly MESSAGE_QUEUE_MAX = 100;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically cleanup expired sessions every 30 seconds
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredSessions(),
      30000,
    );
  }

  /**
   * Create or get session
   */
  getOrCreateSession(sessionId: string): SessionState {
    if (!this.sessions.has(sessionId)) {
      const now = Date.now();
      this.sessions.set(sessionId, {
        sessionId,
        createdAt: now,
        lastActivity: now,
        isWSConnected: false,
        pendingMessages: [],
        pendingRequests: new Map(),
      });
      console.log(`[Session] Created new session: ${sessionId}`);
    }

    const session = this.sessions.get(sessionId)!;
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Create MCP Server instance for a session with handlers setup
   */
  createMCPServerForSession(sessionId: string, wsManager: any): Server {
    const session = this.getOrCreateSession(sessionId);

    if (session.mcpServer) {
      console.debug(`[Session] MCP Server already exists for ${sessionId}`);
      return session.mcpServer;
    }

    session.mcpServer = new Server(
      {
        name: 'mcp-server-for-fe',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Setup handlers for this server instance
    this.setupSessionMCPHandlers(session.mcpServer, sessionId, wsManager);

    console.log(`[Session] Created MCP Server for session: ${sessionId}`);
    return session.mcpServer;
  }

  /**
   * Get MCP Server instance for a session
   */
  getMCPServer(sessionId: string): Server | undefined {
    const session = this.sessions.get(sessionId);
    return session?.mcpServer;
  }

  /**
   * Setup MCP handlers for a specific session server
   */
  private setupSessionMCPHandlers(
    server: Server,
    sessionId: string,
    wsManager: any,
  ): void {
    const {
      ListToolsRequestSchema,
      CallToolRequestSchema,
    } = require('@modelcontextprotocol/sdk/types.js');

    // Register tools/list handler
    server.setRequestHandler(
      ListToolsRequestSchema,
      async (request: any, extra: any) => {
        console.debug(`[MCP] tools/list request from session: ${sessionId}`);

        const localTools = [
          {
            name: 'client_status',
            description: 'Check if there is a client connected via WebSocket',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ];

        const ws = this.getWebSocket(sessionId);
        if (ws) {
          try {
            console.debug(
              `[MCP] Forwarding tools/list to Service Worker for session: ${sessionId}`,
            );
            const response = await wsManager.callServiceWorkerTool(sessionId, {
              jsonrpc: '2.0',
              method: 'tools/list',
            });

            if (response.result && Array.isArray(response.result.tools)) {
              console.debug(
                `[MCP] Received ${response.result.tools.length} tools from Service Worker`,
              );
              return {
                tools: [...localTools, ...response.result.tools],
              };
            }
          } catch (error) {
            console.error(
              `[MCP] Error fetching tools from Service Worker for session ${sessionId}:`,
              error instanceof Error ? error.message : String(error),
            );
          }
        } else {
          console.warn(
            `[MCP] tools/list: No WebSocket connection for session ${sessionId}`,
          );
        }

        return {
          tools: localTools,
        };
      },
    );

    // Register tools/call handler
    server.setRequestHandler(
      CallToolRequestSchema,
      async (request: any, extra: any) => {
        const { name, arguments: args } = request.params;
        console.debug(`[MCP] tools/call: ${name} from session: ${sessionId}`);

        if (name === 'client_status') {
          const ws = this.getWebSocket(sessionId);
          const health = this.isSessionHealthy(sessionId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    isConnected: !!ws,
                    sessionId,
                    isHealthy: health.healthy,
                    message: ws
                      ? `Client connected for session ${sessionId}`
                      : `No client connected for session ${sessionId}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Proxy other tools to Service Worker
        try {
          const ws = this.getWebSocket(sessionId);
          if (!ws) {
            throw new Error(`No WebSocket connection for session ${sessionId}`);
          }

          console.debug(
            `[MCP] Forwarding tool call to Service Worker: ${name}`,
          );
          const response = await wsManager.callServiceWorkerTool(sessionId, {
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name,
              arguments: args,
            },
          });

          if (response.error) {
            throw new Error(
              response.error.message || 'Error calling tool in Service Worker',
            );
          }

          console.debug(`[MCP] Tool call completed: ${name}`);
          return response.result;
        } catch (error) {
          console.error(
            `[MCP] Error proxying tool ${name} to Service Worker for session ${sessionId}:`,
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      },
    );
  }

  /**
   * Register WebSocket connection for a session
   */
  registerWebSocket(sessionId: string, ws: WebSocket): void {
    const session = this.getOrCreateSession(sessionId);
    session.ws = ws;
    session.isWSConnected = true;
    session.lastActivity = Date.now();
    console.log(`[Session] WebSocket registered for ${sessionId}`);
  }

  /**
   * Unregister WebSocket connection for a session
   */
  unregisterWebSocket(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ws = undefined;
      session.isWSConnected = false;
      session.lastActivity = Date.now();
      console.log(`[Session] WebSocket unregistered for ${sessionId}`);
    }
  }

  /**
   * Get WebSocket connection for a session
   */
  getWebSocket(sessionId: string): WebSocket | undefined {
    const session = this.sessions.get(sessionId);
    return session?.ws;
  }

  /**
   * Mark HTTP connection state
   */
  attachTransport(
    sessionId: string,
    transport: StreamableHTTPServerTransport,
  ): void {
    const session = this.getOrCreateSession(sessionId);
    session.transport = transport;
    session.lastActivity = Date.now();
    console.debug(`[Session] HTTP transport connected for ${sessionId}`);
  }

  closeTransport(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.transport) {
      session.transport = undefined;
      console.debug(`[Session] HTTP transport closed for ${sessionId}`);
    }
  }

  /**
   * Add message to queue (server-initiated message)
   */
  enqueueMessage(sessionId: string, message: any): void {
    const session = this.getOrCreateSession(sessionId);
    session.pendingMessages.push({
      ...message,
      enqueuedAt: Date.now(),
    });

    // Limit queue size
    if (session.pendingMessages.length > this.MESSAGE_QUEUE_MAX) {
      session.pendingMessages.shift();
      console.warn(
        `[Session] Message queue exceeded limit for ${sessionId}, dropped oldest`,
      );
    }

    session.lastActivity = Date.now();
    console.debug(
      `[Session] Enqueued message for ${sessionId}, queue size: ${session.pendingMessages.length}`,
    );
  }

  /**
   * Dequeue all messages
   */
  dequeueMessages(sessionId: string): any[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const messages = session.pendingMessages;
    session.pendingMessages = [];
    session.lastActivity = Date.now();

    if (messages.length > 0) {
      console.debug(
        `[Session] Dequeued ${messages.length} messages for ${sessionId}`,
      );
    }

    return messages;
  }

  /**
   * Register pending request
   */
  registerPendingRequest(sessionId: string, requestId: string): void {
    const session = this.getOrCreateSession(sessionId);
    session.pendingRequests.set(requestId, {
      id: requestId,
      createdAt: Date.now(),
    });
    session.lastActivity = Date.now();
  }

  /**
   * Complete pending request
   */
  completePendingRequest(sessionId: string, requestId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingRequests.delete(requestId);
      session.lastActivity = Date.now();
    }
  }

  /**
   * Get session state
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check session health status
   */
  isSessionHealthy(sessionId: string): { healthy: boolean; reason?: string } {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { healthy: false, reason: 'Session not found' };
    }

    const isExpired = Date.now() - session.lastActivity > this.SESSION_TIMEOUT;
    if (isExpired) {
      return { healthy: false, reason: 'Session expired' };
    }

    if (!session.isWSConnected && !session.transport) {
      return { healthy: false, reason: 'No active connections' };
    }

    return { healthy: true };
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        expired.push(sessionId);

        // Close MCP Server instance
        if (session.mcpServer) {
          try {
            session.mcpServer.close();
            console.debug(
              `[Session] Closed MCP Server for expired session: ${sessionId}`,
            );
          } catch (error) {
            console.warn(
              `[Session] Error closing MCP Server for session ${sessionId}:`,
              error,
            );
          }
        }

        this.sessions.delete(sessionId);
      }
    }

    if (expired.length > 0) {
      console.debug(
        `[Session] Cleaned up ${expired.length} expired sessions: ${expired.join(', ')}`,
      );
    }
  }

  /**
   * Get all active sessions (for debugging)
   */
  getAllSessions(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Destroy session manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all MCP Server instances
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.mcpServer) {
        try {
          session.mcpServer.close();
          console.debug(
            `[Session] Closed MCP Server for session: ${sessionId}`,
          );
        } catch (error) {
          console.warn(
            `[Session] Error closing MCP Server for session ${sessionId}:`,
            error,
          );
        }
      }
    }

    this.sessions.clear();
  }
}
