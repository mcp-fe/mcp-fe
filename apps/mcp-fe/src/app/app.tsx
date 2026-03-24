import { MCPToolsProvider } from '@mcp-fe/react-tools';
import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';
import { useSessionManager } from './hooks/useSessionManager';
import styles from './app.module.scss';
import { Modal } from './components/Modal';
import { AIAgentInstructions } from './components/AIAgentInstructions';
import { ConnectionPanel } from './components/ConnectionPanel';
import { Routes, Link, Route, useLocation } from 'react-router-dom';
import { useStoredEvents } from './hooks/useStoredEvents';
import { useAppNavigateTool } from './hooks/useAppNavigateTool';
import { ROUTE_DEFINITIONS } from './config/routeDefinitions';
import { useState } from 'react';
import { FormsToolsProvider } from './pages/FormsPage/FormsToolsContext';
import { DataTableToolsProvider } from './pages/DataTablePage/DataTableToolsContext';

/** Path for nav link (strip /* for splat routes) */
function navPath(path: string) {
  return path.replace(/\/\*$/, '') || '/';
}

export function App() {
  useReactRouterEventTracker();
  useAppNavigateTool();
  const { token } = useSessionManager();
  const { events } = useStoredEvents(1000);
  const location = useLocation();
  const [showInstructions, setShowInstructions] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 768 : true,
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <MCPToolsProvider
      authToken={token}
      initOptions={{
        backendWsUrl: process.env.MCP_WS_URL,
        sharedWorkerUrl: `/mcp-shared-worker.js?v=${process.env.MCP_BUILD_ID}`,
        serviceWorkerUrl: `/mcp-service-worker.js?v=${process.env.MCP_BUILD_ID}`,
      }}
    >
      <DataTableToolsProvider>
        <FormsToolsProvider>
          <div className={styles.appContainer}>
            <header className={styles.appHeader}>
              <div className={styles.headerLeft}>
                <Link to="/" className={styles.siteTitle}>MCP-FE Demo</Link>
                <nav className={styles.headerNav}>
                  <ul>
                    {ROUTE_DEFINITIONS.map((def) => {
                      const to = navPath(def.path);
                      const isActive =
                        def.path === '/navigation/*'
                          ? location.pathname.startsWith('/navigation')
                          : location.pathname === to;
                      return (
                        <li key={def.path}>
                          <Link to={to} className={isActive ? 'active' : ''}>
                            {def.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>

              {/* Mobile hamburger button */}
              <button
                className={styles.mobileNavToggle}
                onClick={() => setIsMobileNavOpen((prev) => !prev)}
                aria-label={isMobileNavOpen ? 'Close menu' : 'Open menu'}
              >
                {isMobileNavOpen ? '✕' : '☰'}
              </button>

              {/* Mobile dropdown nav */}
              <nav
                className={`${styles.mobileNav} ${isMobileNavOpen ? styles.open : ''}`}
              >
                <ul>
                  {ROUTE_DEFINITIONS.map((def) => {
                    const to = navPath(def.path);
                    const isActive =
                      def.path === '/navigation/*'
                        ? location.pathname.startsWith('/navigation')
                        : location.pathname === to;
                    return (
                      <li key={def.path}>
                        <Link
                          to={to}
                          className={isActive ? 'active' : ''}
                          onClick={() => setIsMobileNavOpen(false)}
                        >
                          {def.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </header>

            <main
              className={`${styles.mainLayout} ${!isSidebarOpen ? styles.noSidebar : ''}`}
            >
              <section className={styles.contentArea}>
                <div className="card">
                  <Routes>
                    {ROUTE_DEFINITIONS.map((def) => (
                      <Route
                        key={def.path}
                        path={def.path}
                        element={def.element}
                      />
                    ))}
                  </Routes>
                </div>
              </section>

              {/* Semi-transparent overlay to close mobile sidebar */}
              {isSidebarOpen && (
                <div
                  className={styles.sidebarOverlay}
                  onClick={() => setIsSidebarOpen(false)}
                />
              )}

              {/* Sidebar */}
              <div
                className={`${styles.sidebar} ${isSidebarOpen ? styles.mobileOpen : ''}`}
              >
                {isSidebarOpen && (
                  <aside className={styles.sidebarContent}>
                    <ConnectionPanel
                      onShowInstructions={() => setShowInstructions(true)}
                    />

                    <div className={`card ${styles.eventLogCard}`}>
                      <h2>Live Event Log (IndexedDB)</h2>
                      <ul className="event-list">
                        {events.length === 0 && (
                          <li>No events tracked yet.</li>
                        )}
                        {events.map((event) => (
                          <li key={event.id}>
                            <span className="event-time">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="event-type">{event.type}</span>
                            <span className="event-details">
                              {event.type === 'navigation' &&
                                `to: ${event.to}`}
                              {event.type === 'click' &&
                                `on: ${event.element}${event.elementText ? ` ("${event.elementText}")` : ''}`}
                              {event.type === 'input' &&
                                `in: ${event.element}${event.metadata?.value ? ` (value: ${event.metadata.value})` : ''}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </aside>
                )}

                {/* Desktop sidebar toggle (inside sidebar, hidden on mobile) */}
                <button
                  className={`${styles.sidebarToggleBtn} ${isSidebarOpen ? '' : styles.closed}`}
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                >
                  {isSidebarOpen ? '›' : '‹'}
                </button>
              </div>
            </main>

            {/* Mobile sidebar toggle – always fixed at right edge, separate from
                sidebar so it isn't displaced by the sidebar's `right` animation */}
            <button
              className={styles.mobileSidebarToggle}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {isSidebarOpen ? '›' : '‹'}
            </button>

            {/* AI Agent Instructions Modal */}
            <Modal
              isOpen={showInstructions}
              onClose={() => setShowInstructions(false)}
              title="🤖 Connect AI Agent to MCP-FE Server"
              maxWidth="700px"
              footerContent={
                <button
                  className="btn btn-primary"
                  onClick={() => setShowInstructions(false)}
                >
                  Got it!
                </button>
              }
            >
              <AIAgentInstructions token={token} />
            </Modal>
          </div>
        </FormsToolsProvider>
      </DataTableToolsProvider>
    </MCPToolsProvider>
  );
}

export default App;
