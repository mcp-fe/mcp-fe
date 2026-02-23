import { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMCPTool } from '@mcp-fe/react-tools';
import { getNavigableRoutes } from '../config/routeDefinitions';

const inputSchema = {
  type: 'object' as const,
  properties: {
    path: {
      type: 'string',
      description:
        'Path to navigate to (e.g. /, /forms, /data-table, /navigation). Omit to list available routes.',
    },
  },
};

type Args = { path?: string };

/**
 * MCP Tool: List routes and navigate the app via React Router.
 * Routes are loaded dynamically from the same route definitions used to render the app (getNavigableRoutes).
 */
export function useAppNavigateTool() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);

  useEffect(() => {
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  useMCPTool({
    name: 'app_navigate',
    description:
      'List available routes or navigate to a path in the app. Call without "path" to get the list of routes and current path; call with "path" to navigate to that route.',
    inputSchema,
    handler: async (args: unknown) => {
      const { path } = (args ?? {}) as Args;
      const currentPath = currentPathRef.current;

      if (path !== undefined && path !== '') {
        navigate(path);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                navigatedTo: path,
                previousPath: currentPath,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              currentPath: currentPath,
              routes: getNavigableRoutes(),
            }),
          },
        ],
      };
    },
  });
}
