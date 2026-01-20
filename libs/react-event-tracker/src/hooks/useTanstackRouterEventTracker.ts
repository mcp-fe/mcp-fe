import { useEffect, useRef } from 'react';
import { useLocation } from '@tanstack/react-router';
import {
  initEventTracker,
  trackNavigation,
  trackClick,
  trackInput,
} from '@mcp-fe/event-tracker';

/**
 * Hook to initialize and track user activity
 * Should be used once in the root component
 */
export function useTanstackRouterEventTracker(): void {
  const location = useLocation();
  const prevPathRef = useRef<string>(location.pathname);
  const isInitializedRef = useRef(false);

  // Initialize worker (SharedWorker preferred, ServiceWorker fallback) and event tracker
  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }

    // initEventTracker will try SharedWorker first, then fallback to ServiceWorker automatically
    // We don't need to manually register ServiceWorker here - initEventTracker handles it
    initEventTracker()
      .then(() => {
        isInitializedRef.current = true;
      })
      .catch((error) => {
        console.error('Worker initialization failed:', error);
        isInitializedRef.current = false;
      });
  }, []);

  // Track navigation
  useEffect(() => {
    const currentPath = location.pathname;
    const prevPath = prevPathRef.current;

    if (prevPath !== currentPath && isInitializedRef.current) {
      trackNavigation(prevPath, currentPath, currentPath).catch((error) => {
        console.error('Failed to track navigation:', error);
      });
      prevPathRef.current = currentPath;
    }
  }, [location.pathname]);

  // Track clicks
  useEffect(() => {
    if (!isInitializedRef.current) {
      return;
    }

    const handleClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      if (target) {
        // Ignore clicks on interactive elements that are already tracked by their own handlers
        const isInteractive =
          target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.closest('button') ||
          target.closest('a');

        if (!isInteractive) {
          trackClick(target, location.pathname).catch((error) => {
            console.error('Failed to track click:', error);
          });
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [location.pathname]);

  // Track input changes (debounced)
  useEffect(() => {
    if (!isInitializedRef.current) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleInput = (event: Event): void => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          trackInput(target, target.value, location.pathname).catch((error) => {
            console.error('Failed to track input:', error);
          });
        }, 1000); // Debounce by 1 second
      }
    };

    document.addEventListener('input', handleInput, true);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('input', handleInput, true);
    };
  }, [location.pathname]);
}
