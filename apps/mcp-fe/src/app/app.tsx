// Uncomment this line to use CSS modules
import { MCPToolsProvider } from '@mcp-fe/react-tools';
import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';
import { useSessionManager } from './hooks/useSessionManager';
// import styles from './app.module.scss';
import { HomePage } from './pages/HomePage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { FormsPage } from './pages/FormsPage';
import { DataTablePage } from './pages/DataTablePage';
import { NavigationPage } from './pages/NavigationPage';
import { Modal } from './components/Modal';
import { AIAgentInstructions } from './components/AIAgentInstructions';
import { ConnectionPanel } from './components/ConnectionPanel';
import { Routes, Link, Route, useLocation } from 'react-router-dom';
import { useStoredEvents } from './hooks/useStoredEvents';
import { useState } from 'react';

export function App() {
  useReactRouterEventTracker();
  const { token } = useSessionManager();
  const { events } = useStoredEvents(1000);
  const location = useLocation();
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <MCPToolsProvider backendWsUrl="ws://localhost:3001" authToken={token}>
      <div className="app-container">
        <header className="app-header">
          <div className="header-left">
            <h1>MCP-FE Demo</h1>
            <nav className="header-nav">
              <ul>
                <li>
                  <Link
                    to="/"
                    className={location.pathname === '/' ? 'active' : ''}
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/how-it-works"
                    className={
                      location.pathname === '/how-it-works' ? 'active' : ''
                    }
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link
                    to="/navigation"
                    className={
                      location.pathname.startsWith('/navigation')
                        ? 'active'
                        : ''
                    }
                  >
                    Navigation
                  </Link>
                </li>
                <li>
                  <Link
                    to="/forms"
                    className={location.pathname === '/forms' ? 'active' : ''}
                  >
                    Forms
                  </Link>
                </li>
                <li>
                  <Link
                    to="/data-table"
                    className={
                      location.pathname === '/data-table' ? 'active' : ''
                    }
                  >
                    Data Table
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        <main className="main-layout">
          <section className="content-area">
            <div className="card">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/forms" element={<FormsPage />} />
                <Route path="/data-table" element={<DataTablePage />} />
                <Route path="/navigation/*" element={<NavigationPage />} />
              </Routes>
            </div>
          </section>

          <aside className="sidebar">
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
