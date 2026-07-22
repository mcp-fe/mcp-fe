import { WebSocketTransport } from './websocket-transport';

type Listener = (event: any) => void;

class FakeSocket {
  listeners: Record<string, Listener[]> = {};
  sent: string[] = [];
  closed = false;

  addEventListener(type: string, listener: Listener) {
    (this.listeners[type] ||= []).push(listener);
  }

  emit(type: string, event: any = {}) {
    (this.listeners[type] || []).forEach((l) => l(event));
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }
}

describe('WebSocketTransport', () => {
  let socket: FakeSocket;
  let transport: WebSocketTransport;

  beforeEach(() => {
    socket = new FakeSocket();
    transport = new WebSocketTransport(socket as unknown as WebSocket);
  });

  it('forwards a well-formed message to onmessage', async () => {
    const onmessage = jest.fn();
    transport.onmessage = onmessage;
    await transport.start();

    const message = { jsonrpc: '2.0', method: 'ping', id: 1 };
    socket.emit('message', { data: JSON.stringify(message) });

    expect(onmessage).toHaveBeenCalledWith(message);
  });

  it('reports a descriptive error including the raw payload on malformed JSON', async () => {
    const onerror = jest.fn();
    transport.onerror = onerror;
    await transport.start();

    socket.emit('message', { data: 'not json' });

    expect(onerror).toHaveBeenCalledTimes(1);
    const err = onerror.mock.calls[0][0] as Error;
    expect(err.message).toContain('Failed to parse WebSocket message');
    expect(err.message).toContain('not json');
  });

  it('calls onclose when the socket closes', async () => {
    const onclose = jest.fn();
    transport.onclose = onclose;
    await transport.start();

    socket.emit('close');

    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('surfaces the underlying message when the error event carries one', async () => {
    const onerror = jest.fn();
    transport.onerror = onerror;
    await transport.start();

    socket.emit('error', { message: 'ECONNRESET' });

    expect(onerror).toHaveBeenCalledWith(
      new Error('WebSocket error: ECONNRESET'),
    );
  });

  it('surfaces event.error.message when present instead of the top-level message', async () => {
    const onerror = jest.fn();
    transport.onerror = onerror;
    await transport.start();

    socket.emit('error', { error: new Error('socket hang up') });

    expect(onerror).toHaveBeenCalledWith(
      new Error('WebSocket error: socket hang up'),
    );
  });

  it('falls back to a generic reason when the error event carries no detail', async () => {
    const onerror = jest.fn();
    transport.onerror = onerror;
    await transport.start();

    socket.emit('error', {});

    expect(onerror).toHaveBeenCalledWith(
      new Error('WebSocket error: unknown reason'),
    );
  });

  it('send() JSON-encodes the message and forwards it to the socket', async () => {
    const message = { jsonrpc: '2.0', method: 'tools/list', id: 1 };
    await transport.send(message as any);

    expect(socket.sent).toEqual([JSON.stringify(message)]);
  });

  it('close() closes the underlying socket', async () => {
    await transport.close();
    expect(socket.closed).toBe(true);
  });
});
