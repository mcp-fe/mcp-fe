import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  initEventTracker,
  setAuthToken,
  trackNavigation,
  trackClick,
  trackInput,
  type WorkerClientInitOptions,
} from '@mcp-fe/event-tracker';

export function useReactRouterEventTracker(
  initOptions?: WorkerClientInitOptions,
): { setAuthToken: (token: string) => void } {
  const location = useLocation();
  const [isInitialized, setIsInitialized] = useState(false);
  const hasInitialized = useRef(false);

  const currentPathRef = useRef(location.pathname);
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    prevPathRef.current = currentPathRef.current;
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    // Protect against double-invocation
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    initEventTracker(initOptions)
      .then(() => {
        setIsInitialized(true);
      })
      .catch((error) => {
        console.error(
          '[ReactEventTracker] Worker initialization failed:',
          error,
        );
      });
  }, [initOptions]);

  useEffect(() => {
    if (!isInitialized) return;

    const prevPath = prevPathRef.current;
    const currentPath = currentPathRef.current;

    if (prevPath && prevPath !== currentPath) {
      trackNavigation(prevPath, currentPath, currentPath).catch((error) => {
        console.error('[ReactEventTracker] Failed to track navigation:', error);
      });
    }
  }, [location.pathname, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    const handleClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      if (!target) return;

      const isInteractive =
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a');

      if (!isInteractive) {
        trackClick(target, currentPathRef.current).catch((error) => {
          console.error('[ReactEventTracker] Failed to track click:', error);
        });
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleInput = (event: Event): void => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          trackInput(target, target.value, currentPathRef.current).catch(
            (error) => {
              console.error(
                '[ReactEventTracker] Failed to track input:',
                error,
              );
            },
          );
        }, 1000); // Debounce by 1 second
      }
    };

    document.addEventListener('input', handleInput, true);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('input', handleInput, true);
    };
  }, [isInitialized]);

  return {
    setAuthToken,
  };
}
