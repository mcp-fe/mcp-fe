import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getConnectionStatus,
  onConnectionStatus,
  offConnectionStatus,
} from '@mcp-fe/event-tracker';

export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  // stable checker used both on mount and as a periodic poll
  const checkStatus = useCallback(async () => {
    try {
      const status = await getConnectionStatus();
      if (mountedRef.current) setIsConnected(!!status);
    } catch {
      if (mountedRef.current) setIsConnected(false);
    }
  }, []);

  // stable callback passed to the event-tracker subscription API
  const handleConnectionUpdate = useCallback((connected: boolean) => {
    if (!mountedRef.current) {
      return;
    }

    if (connected) {
      // set immediately on positive events
      setIsConnected(true);
      return;
    }

    // on negative events, confirm via an explicit request to avoid spurious flips
    (async () => {
      try {
        const actual = await getConnectionStatus();
        if (mountedRef.current) setIsConnected(!!actual);
      } catch {
        if (mountedRef.current) setIsConnected(false);
      }
    })();
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // initial check
    checkStatus();

    // subscribe and store the stable handler reference
    onConnectionStatus(handleConnectionUpdate);

    return () => {
      mountedRef.current = false;
      offConnectionStatus(handleConnectionUpdate);
    };
  }, [checkStatus, handleConnectionUpdate]);

  return isConnected;
}
