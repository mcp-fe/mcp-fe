import { useState, useEffect } from 'react';
import { getConnectionStatus } from '@mcp-fe/event-tracker';

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

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'CONNECTION_STATUS') {
        setIsConnected(event.data.connected);
      }
    };

    checkStatus();
    navigator.serviceWorker.addEventListener('message', handleMessage);

    const interval = setInterval(checkStatus, 5000);

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  return isConnected;
}
