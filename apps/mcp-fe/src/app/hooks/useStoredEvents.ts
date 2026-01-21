import { useState, useEffect } from 'react';
import { getStoredEvents, type UserEvent } from '@mcp-fe/event-tracker';

export function useStoredEvents(refreshInterval = 2000) {
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchEvents = async () => {
      try {
        const storedEvents = await getStoredEvents();
        if (mounted) {
          setEvents(storedEvents);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshInterval]);

  return { events, error };
}
