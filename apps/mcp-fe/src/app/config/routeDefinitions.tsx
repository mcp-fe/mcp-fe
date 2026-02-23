import type { ReactNode } from 'react';
import { HomePage } from '../pages/HomePage';
import { HowItWorksPage } from '../pages/HowItWorksPage';
import { FormsPage } from '../pages/FormsPage';
import { DataTablePage } from '../pages/DataTablePage';
import { NavigationPage } from '../pages/NavigationPage';

export interface RouteDefinition {
  path: string;
  element: ReactNode;
  label: string;
  /** Nested paths and labels for routes rendered inside this route (e.g. NavigationPage sub-routes) */
  children?: { path: string; label: string }[];
}

/**
 * Single source of truth for app routes. Used to render <Route>s and to list routes in the MCP navigate tool.
 */
export const ROUTE_DEFINITIONS: RouteDefinition[] = [
  { path: '/', element: <HomePage />, label: 'Home' },
  { path: '/how-it-works', element: <HowItWorksPage />, label: 'How It Works' },
  { path: '/forms', element: <FormsPage />, label: 'Forms' },
  { path: '/data-table', element: <DataTablePage />, label: 'Data Table' },
  {
    path: '/navigation/*',
    element: <NavigationPage />,
    label: 'Navigation',
    children: [
      { path: '/navigation', label: 'Navigation (Overview)' },
      { path: '/navigation/integration', label: 'Navigation – Integration' },
      { path: '/navigation/examples', label: 'Navigation – Examples' },
      { path: '/navigation/troubleshooting', label: 'Navigation – Troubleshooting' },
    ],
  },
];

export interface NavigableRoute {
  path: string;
  label: string;
}

/**
 * Flat list of all navigable path + label, derived from ROUTE_DEFINITIONS.
 * Use for MCP app_navigate tool and anywhere a full route list is needed.
 */
export function getNavigableRoutes(): NavigableRoute[] {
  const list: NavigableRoute[] = [];
  for (const r of ROUTE_DEFINITIONS) {
    if (r.children?.length) {
      list.push(...r.children);
    } else {
      list.push({ path: r.path, label: r.label });
    }
  }
  return list;
}
