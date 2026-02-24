// Uncomment this line to use CSS modules
import { MCPToolsProvider } from '@mcp-fe/react-tools';
import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';
import { useSessionManager } from './hooks/useSessionManager';
// import styles from './app.module.scss';
import { Modal } from './components/Modal';
import { AIAgentInstructions } from './components/AIAgentInstructions';
import { ConnectionPanel } from './components/ConnectionPanel';
import { Routes, Link, Route, useLocation } from 'react-router-dom';
import { useStoredEvents } from './hooks/useStoredEvents';
import { useAppNavigateTool } from './hooks/useAppNavigateTool';
import { ROUTE_DEFINITIONS } from './config/routeDefinitions';
import { useState } from 'react';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <MCPToolsProvider backendWsUrl="ws://localhost:3001" authToken={token}>
      <div className="app-container">
        <header className="app-header">
          <div className="header-left">
            <h1>MCP-FE Demo</h1>
            <nav className="header-nav">
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
        </header>

        <main
          className={`main-layout ${
            isSidebarOpen ? 'layout-with-sidebar' : 'layout-no-sidebar'
          }`}
        >
          <section className="content-area">
            <div className="card">
              <Routes>
                {ROUTE_DEFINITIONS.map((def) => (
                  <Route key={def.path} path={def.path} element={def.element} />
                ))}
              </Routes>
            </div>
          </section>

          <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
            {isSidebarOpen && (
              <aside className="sidebar-content">
                <ConnectionPanel
                  onShowInstructions={() => setShowInstructions(true)}
                />

                <div className="card event-log-card">
                  <h2>Live Event Log (IndexedDB)</h2>
                  <ul className="event-list">
                    {events.length === 0 && <li>No events tracked yet.</li>}
                    {events.map((event) => (
                      <li key={event.id}>
                        <span className="event-time">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="event-type">{event.type}</span>
                        <span className="event-details">
                          {event.type === 'navigation' && `to: ${event.to}`}
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
            <button
              className={`sidebar-toggle-btn ${
                isSidebarOpen ? 'open' : 'closed'
              }`}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {isSidebarOpen ? '›' : '‹'}
            </button>
          </div>
        </main>

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
    </MCPToolsProvider>
  );
}

export default App;
