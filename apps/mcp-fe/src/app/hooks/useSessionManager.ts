import { useContext } from 'react';
import { SessionContext } from '../contexts/SessionContext';

/**
 * Hook for managing session user and JWT token
 * Uses global SessionContext to share state across the application
 */
export function useSessionManager() {
  const context = useContext(SessionContext);

  if (context === undefined) {
    throw new Error('useSessionManager must be used within a SessionProvider');
  }

  return context;
}
