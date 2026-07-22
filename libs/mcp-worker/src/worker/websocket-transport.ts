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
        const cause = error instanceof Error ? error.message : String(error);
        this.onerror?.(
          new Error(
            `Failed to parse WebSocket message: ${cause} (raw: ${event.data})`,
          ),
        );
      }
    });

    this.ws.addEventListener('close', () => {
      this.onclose?.();
    });

    this.ws.addEventListener('error', (event) => {
      // The browser WebSocket spec deliberately omits detail from error
      // events, but runtimes like `ws` attach `.message`/`.error` — surface
      // whatever is actually available instead of a fixed generic string.
      const detail =
        (event as { message?: string })?.message ||
        (event as { error?: Error })?.error?.message ||
        'unknown reason';
      this.onerror?.(new Error(`WebSocket error: ${detail}`));
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.ws.send(JSON.stringify(message));
  }

  async close(): Promise<void> {
    this.ws.close();
  }
}
