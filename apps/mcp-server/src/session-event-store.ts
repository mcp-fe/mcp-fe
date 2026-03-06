import type { EventStore, EventId, StreamId } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Per-session in-memory EventStore for StreamableHTTP resumability.
 *
 * Stores server-initiated notifications (e.g. notifications/tools/list_changed)
 * so they can be replayed when the MCP client (Claude) reconnects the GET SSE
 * stream with a Last-Event-ID header.
 *
 * Not intended for production use – events are lost on server restart.
 */
export class SessionEventStore implements EventStore {
  private events = new Map<EventId, { streamId: StreamId; message: JSONRPCMessage }>();

  private generateEventId(streamId: StreamId): EventId {
    return `${streamId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
    const eventId = this.generateEventId(streamId);
    this.events.set(eventId, { streamId, message });
    console.debug(`[EventStore] Stored event ${eventId} for stream ${streamId}`);
    return eventId;
  }

  async replayEventsAfter(
    lastEventId: EventId,
    { send }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> },
  ): Promise<StreamId> {
    if (!lastEventId || !this.events.has(lastEventId)) {
      return '';
    }

    const { streamId } = this.events.get(lastEventId)!;

    const sorted = [...this.events.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    let found = false;
    for (const [eventId, entry] of sorted) {
      if (entry.streamId !== streamId) continue;
      if (eventId === lastEventId) { found = true; continue; }
      if (found) {
        console.debug(`[EventStore] Replaying event ${eventId} for stream ${streamId}`);
        await send(eventId, entry.message);
      }
    }

    return streamId;
  }
}
