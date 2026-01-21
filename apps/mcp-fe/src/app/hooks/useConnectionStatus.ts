import { useState, useEffect } from 'react';
import { getConnectionStatus, onConnectionStatus, offConnectionStatus } from '@mcp-fe/event-tracker';

export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      const status = await getConnectionStatus();
      if (mounted) {
        setIsConnected(status);
      }
    };

    checkStatus();

    // subscribe to connection status updates from the event-tracker library
    const cb = (connected: boolean) => {
      if (mounted) setIsConnected(connected);
    };

    onConnectionStatus(cb);

    // also poll periodically as a fallback
    const interval = setInterval(checkStatus, 5000);

    return () => {
      mounted = false;
      offConnectionStatus(cb);
      clearInterval(interval);
    };
  }, []);

  return isConnected;
}
