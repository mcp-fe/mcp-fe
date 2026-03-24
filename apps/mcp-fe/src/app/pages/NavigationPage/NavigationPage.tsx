import { Link, Routes, Route, useLocation } from 'react-router-dom';
import styles from './NavigationPage.module.scss';

const navigationItems = [
  { id: 'overview', label: 'Overview', icon: '📋', path: '/navigation' },
  {
    id: 'integration',
    label: 'Integration',
    icon: '🔧',
    path: '/navigation/integration',
  },
  {
    id: 'examples',
    label: 'Examples',
    icon: '📚',
    path: '/navigation/examples',
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    icon: '🔍',
    path: '/navigation/troubleshooting',
  },
];

// Overview Section Component (combined with Features)
const OverviewSection = () => (
  <div>
    <h3>Automatic Navigation Tracking</h3>
    <p>
      MCP-FE automatically tracks all navigation events from{' '}
      <strong>React Router</strong> and <strong>Tanstack Router</strong> without
      any manual instrumentation. Simply integrate the tracking hook and every
      route change is captured and stored locally, ready for AI agents to
      analyze.
    </p>

    <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>How It Works:</h4>
    <ul>
      <li>
        <strong>Zero Configuration Tracking:</strong> Use{' '}
        <code>useReactRouterEventTracker()</code> or{' '}
        <code>useTanstackRouterEventTracker()</code> hook in your app - all
        navigation is automatically tracked
      </li>
      <li>
        <strong>Router Integration:</strong> Hooks into React Router's or
        Tanstack Router's navigation events using their built-in APIs
      </li>
      <li>
        <strong>Rich Event Data:</strong> Captures from/to paths, timestamps,
        user session, and navigation metadata automatically
      </li>
      <li>
        <strong>Local Storage:</strong> Events are stored in IndexedDB via
        Worker, persisting across tabs and page reloads
      </li>
      <li>
        <strong>AI Agent Access:</strong> MCP Proxy Server exposes events to AI
        agents through the Model Context Protocol
      </li>
    </ul>

    <div className={styles.infoBox}>
      <p>
        💡 <strong>Try it now:</strong> Click through the sections in the left
        sidebar and watch the <strong>Live Event Log</strong> in the right
        sidebar. Every navigation is automatically tracked - no extra code
        needed!
      </p>
    </div>

    <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Key Benefits:</h4>
    <div className={styles.featureGrid}>
      <div className={styles.featureItem}>
        <h4>🚀 No Manual Tracking</h4>
        <p>
          Just add one hook to your app. No need to manually track{' '}
          <code>&lt;Link&gt;</code> clicks, <code>navigate()</code> calls, or
          route changes - it's all automatic.
        </p>
      </div>
      <div className={styles.featureItem}>
        <h4>🔄 Works with Any Router</h4>
        <p>
          Support for both <strong>React Router v6+</strong> and{' '}
          <strong>Tanstack Router</strong>. Uses official APIs for reliable
          tracking.
        </p>
      </div>
      <div className={styles.featureItem}>
        <h4>📍 Complete Context</h4>
        <p>
          Every navigation event includes full context: previous path, new path,
          timestamp, user session - everything AI agents need to understand user
          behavior.
        </p>
      </div>
      <div className={styles.featureItem}>
        <h4>🤖 AI-Ready Data</h4>
        <p>
          Events are immediately available to AI agents via MCP protocol,
          enabling contextual assistance, debugging help, and behavioral
          insights.
        </p>
      </div>
    </div>
  </div>
);

// Integration Section Component
const IntegrationSection = () => (
  <div>
    <h3>Integration Guide</h3>
    <p>
      Getting started with MCP-FE navigation tracking in your React application:
    </p>
    <div className={styles.codeExample}>
      <h4>1. Install the required packages:</h4>
      <pre>{`npm install @mcp-fe/react-event-tracker @mcp-fe/mcp-worker`}</pre>

      <h4>2. Make sure the MCP worker files are publicly accessible:</h4>
      <pre>{`// vite.config.ts

import { defineConfig } from 'vite';

export default defineConfig({
  // ... other config
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        'mcp-service-worker': './node_modules/@mcp-fe/mcp-worker/src/mcp-service-worker.ts',
        'mcp-shared-worker': './node_modules/@mcp-fe/mcp-worker/src/mcp-shared-worker.ts',
      },
      output: {
        entryFileNames: (chunk) => {
          // Keep worker files at root so they are served from /
          if (chunk.name.startsWith('mcp-')) return '[name].js';
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
`}</pre>

      <h4>3. Wrap your app with MCPToolsProvider:</h4>
      <pre>
        {`import { MCPToolsProvider } from '@mcp-fe/react-tools';

// MCPToolsProvider initializes the worker client and provides
// context for all useMCPTool hooks. Place it at the root of your app.
function Root() {
  return (
    <MCPToolsProvider
      initOptions={{
        backendWsUrl: 'ws://localhost:3001',
        sharedWorkerUrl: '/mcp-shared-worker.js',
        serviceWorkerUrl: '/mcp-service-worker.js',
      }}
    >
      <App />
    </MCPToolsProvider>
  );
}
`}
      </pre>

      <h4>4. Use the hook in your React Router app:</h4>
      <pre>{`import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';

function App() {
  const { setAuthToken } = useReactRouterEventTracker();

  useEffect(() => {
    setAuthToken('your-jwt-token');
  }, []);

  return <Routes>...</Routes>;
}`}</pre>

      <h4>5. Start the MCP Proxy Server:</h4>
      <pre>{`docker run -p 3001:3001 ghcr.io/mcp-fe/mcp-fe/mcp-server:main`}</pre>

      <p>
        That's it! Navigation events are now automatically tracked and available
        to AI agents through the MCP protocol.
      </p>
    </div>
  </div>
);

// Examples Section Component
const ExamplesSection = () => (
  <div>
    <h3>Real-World Use Cases</h3>
    <p>
      Here are practical examples of how AI agents can leverage navigation
      tracking data:
    </p>
    <div>
      <div className={styles.scenario}>
        <h4>🤖 In-App AI Copilot</h4>
        <p>
          <strong>Agent Query:</strong> "What is the user currently trying to
          do?"
        </p>
        <p>
          <strong>Response:</strong> "The user visited the Checkout page 3 times
          in the last 5 minutes and navigated back to the Cart each time —
          they're likely stuck on the checkout flow."
        </p>
        <p>
          <em>
            Navigation history gives the copilot the context it needs to provide
            relevant, proactive help without the user having to explain
            anything.
          </em>
        </p>
      </div>

      <div className={styles.scenario}>
        <h4>💬 Support with Full Context</h4>
        <p>
          <strong>Agent Query:</strong> "What did the user do before opening
          this support chat?"
        </p>
        <p>
          <strong>Response:</strong> "User navigated: Home → Forms → filled out
          the registration form → hit Submit → landed on an error page — then
          opened support."
        </p>
        <p>
          <em>
            The support agent already knows the full journey. No screenshots, no
            "can you describe what happened" — just immediate context.
          </em>
        </p>
      </div>

      <div className={styles.scenario}>
        <h4>🗺️ Guided Complex Workflows</h4>
        <p>
          <strong>Agent Query:</strong> "Where is the user in the onboarding
          flow?"
        </p>
        <p>
          <strong>Response:</strong> "User completed steps 1 and 2 (Profile,
          Preferences), skipped step 3 (Billing), and is now on step 4
          (Integrations) — Billing is still incomplete."
        </p>
        <p>
          <em>
            The agent knows exactly which steps were visited and in what order,
            enabling it to guide the user to what's missing instead of pointing
            to generic documentation.
          </em>
        </p>
      </div>

      <div className={styles.scenario}>
        <h4>🌐 Browser-Native Agent Access</h4>
        <p>
          <strong>Browser agent query:</strong> "What has the user been doing in
          this app?"
        </p>
        <p>
          <strong>Response:</strong> "User spent most time on the Data Table
          page, visited Settings twice, and hasn't explored the Reports section
          yet."
        </p>
        <p>
          <em>
            Via the WebMCP adapter, browser-native agents and extensions get the
            same structured navigation data — no proxy required, no DOM
            scraping.
          </em>
        </p>
      </div>
    </div>
  </div>
);

// Troubleshooting Section Component
const TroubleshootingSection = () => (
  <div>
    <h3>Troubleshooting Navigation Tracking</h3>
    <p>
      If navigation events are not being tracked, follow these steps to diagnose
      the issue:
    </p>
    <div>
      <div className={styles.step}>
        <h4>✅ Check Connection Status</h4>
        <p>
          Look at the connection panel in the right sidebar. It should show
          "Connected to MCP Proxy" with a green indicator.
        </p>
        <p>
          <strong>If disconnected:</strong> Verify that the MCP Proxy Server is
          running on <code>ws://localhost:3001</code>
        </p>
      </div>

      <div className={styles.step}>
        <h4>🔍 Verify Event Logging</h4>
        <p>
          Check the "Live Event Log" in the right sidebar. You should see
          navigation events appearing as you click links.
        </p>
        <p>
          <strong>Expected event:</strong>{' '}
          <code>navigation - to: /navigation/features</code>
        </p>
      </div>

      <div className={styles.step}>
        <h4>🔧 Worker Registration</h4>
        <p>
          Open DevTools → Application → Service Workers (or Shared Workers). You
          should see the MCP worker registered.
        </p>
        <p>
          <strong>Common issue:</strong> Workers may be blocked by browser
          security settings. Try accessing via <code>http://localhost</code>{' '}
          instead of <code>file://</code>
        </p>
      </div>

      <div className={styles.step}>
        <h4>🌐 MCP Proxy Server</h4>
        <p>
          Ensure the MCP proxy server is running:
          <pre>{`docker run -p 3001:3001 ghcr.io/mcp-fe/mcp-fe/mcp-server:main`}</pre>
        </p>
        <p>
          Check server logs for connection attempts and errors. The server
          should accept WebSocket connections on port 3001.
        </p>
      </div>

      <div className={styles.step}>
        <h4>🔐 Authentication</h4>
        <p>
          Make sure you have set a valid JWT token using{' '}
          <code>setAuthToken()</code>. Check the Session User field in the
          connection panel.
        </p>
        <p>
          <strong>Note:</strong> This demo uses mock JWT tokens for
          demonstration purposes.
        </p>
      </div>
    </div>
  </div>
);

export const NavigationPage = () => {
  const location = useLocation();

  // Generate breadcrumbs based on current location
  const getBreadcrumbs = () => {
    const breadcrumbs = [
      { label: 'Home', path: '/' },
      { label: 'Navigation Demo', path: '/navigation' },
    ];

    const currentItem = navigationItems.find(
      (item) => item.path === location.pathname,
    );
    if (currentItem && currentItem.path !== '/navigation') {
      breadcrumbs.push({ label: currentItem.label, path: currentItem.path });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className={styles.navigationPage}>
      <div className={styles.pageHeader}>
        <h2>Navigation Demo</h2>

        {/* Breadcrumb Navigation */}
        <nav className={styles.breadcrumb}>
          {breadcrumbs.map((crumb, index) => (
            <span key={index}>
              {index > 0 && <span className={styles.separator}> / </span>}
              <Link to={crumb.path} className={styles.breadcrumbItem}>
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>

      <div className={styles.navigationLayout}>
        {/* Sidebar Navigation */}
        <aside className={styles.navigationSidebar}>
          <nav className={styles.sidebarNav}>
            <h3>Sections</h3>
            <ul>
              {navigationItems.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    className={`${styles.navItem} ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={styles.navigationContent}>
          <Routes>
            <Route path="/" element={<OverviewSection />} />
            <Route path="/integration" element={<IntegrationSection />} />
            <Route path="/examples" element={<ExamplesSection />} />
            <Route
              path="/troubleshooting"
              element={<TroubleshootingSection />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};
