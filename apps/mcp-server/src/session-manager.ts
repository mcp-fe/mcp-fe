import { WebSocket } from 'ws';

/**
 * Session Manager - handles session state and message queueing
 * Tracks active sessions, server-initiated messages, connection state, and WebSocket references
 */

export interface SessionState {
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  isWSConnected: boolean;
  isHTTPConnected: boolean;
  ws?: WebSocket;
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
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 30000);
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
        isHTTPConnected: false,
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
  setHTTPConnected(sessionId: string, connected: boolean): void {
    const session = this.getOrCreateSession(sessionId);
    session.isHTTPConnected = connected;
    session.lastActivity = Date.now();
    console.debug(`[Session] HTTP connection updated for ${sessionId}: ${connected}`);
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
      console.warn(`[Session] Message queue exceeded limit for ${sessionId}, dropped oldest`);
    }

    session.lastActivity = Date.now();
    console.debug(`[Session] Enqueued message for ${sessionId}, queue size: ${session.pendingMessages.length}`);
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
      console.debug(`[Session] Dequeued ${messages.length} messages for ${sessionId}`);
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

    if (!session.isWSConnected && !session.isHTTPConnected) {
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
        this.sessions.delete(sessionId);
      }
    }

    if (expired.length > 0) {
      console.debug(`[Session] Cleaned up ${expired.length} expired sessions: ${expired.join(', ')}`);
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
    this.sessions.clear();
  }
}
