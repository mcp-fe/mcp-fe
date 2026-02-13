import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Custom MCP Transport for WebSocket in Service Worker
 */
export class WebSocketTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private ws: WebSocket) {}

  async start(): Promise<void> {
    this.ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    this.ws.addEventListener('close', () => {
      this.onclose?.();
    });

    this.ws.addEventListener('error', (event) => {
      this.onerror?.(new Error('WebSocket error'));
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.ws.send(JSON.stringify(message));
  }

  async close(): Promise<void> {
    this.ws.close();
  }
}
