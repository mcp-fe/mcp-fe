import { SessionEventStore } from './session-event-store';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

function msg(id: number): JSONRPCMessage {
  return { jsonrpc: '2.0', method: 'notifications/tools/list_changed', params: { id } } as any;
}

describe('SessionEventStore', () => {
  it('storeEvent returns a distinct eventId for each call', async () => {
    const store = new SessionEventStore();
    const id1 = await store.storeEvent('stream-a', msg(1));
    const id2 = await store.storeEvent('stream-a', msg(2));
    expect(id1).not.toEqual(id2);
    expect(typeof id1).toBe('string');
  });

  it('replayEventsAfter returns "" for an unknown lastEventId', async () => {
    const store = new SessionEventStore();
    await store.storeEvent('stream-a', msg(1));
    const send = jest.fn();

    const result = await store.replayEventsAfter('does-not-exist', { send });

    expect(result).toBe('');
    expect(send).not.toHaveBeenCalled();
  });

  it('replayEventsAfter returns "" for an empty lastEventId', async () => {
    const store = new SessionEventStore();
    const send = jest.fn();

    const result = await store.replayEventsAfter('', { send });

    expect(result).toBe('');
    expect(send).not.toHaveBeenCalled();
  });

  it('replays only the events stored after lastEventId, in order, for the same stream', async () => {
    const store = new SessionEventStore();
    const id1 = await store.storeEvent('stream-a', msg(1));
    const id2 = await store.storeEvent('stream-a', msg(2));
    const id3 = await store.storeEvent('stream-a', msg(3));
    const send = jest.fn().mockResolvedValue(undefined);

    const streamId = await store.replayEventsAfter(id1, { send });

    expect(streamId).toBe('stream-a');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, id2, msg(2));
    expect(send).toHaveBeenNthCalledWith(2, id3, msg(3));
  });

  it('does not replay events belonging to a different stream', async () => {
    const store = new SessionEventStore();
    const idA1 = await store.storeEvent('stream-a', msg(1));
    await store.storeEvent('stream-b', msg(99));
    const idA2 = await store.storeEvent('stream-a', msg(2));
    const send = jest.fn().mockResolvedValue(undefined);

    const streamId = await store.replayEventsAfter(idA1, { send });

    expect(streamId).toBe('stream-a');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(idA2, msg(2));
  });

  it('returns the streamId but calls send zero times when lastEventId is the most recent event', async () => {
    const store = new SessionEventStore();
    const id1 = await store.storeEvent('stream-a', msg(1));
    const send = jest.fn();

    const streamId = await store.replayEventsAfter(id1, { send });

    expect(streamId).toBe('stream-a');
    expect(send).not.toHaveBeenCalled();
  });
});
