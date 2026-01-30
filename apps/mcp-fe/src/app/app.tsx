// Uncomment this line to use CSS modules
// import styles from './app.module.scss';
import { HomePage } from './homePage';
import { DashboardPage } from './pages/DashboardPage';
import { FormsPage } from './pages/FormsPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { DataTablePage } from './pages/DataTablePage';
import { NavigationPage } from './pages/NavigationPage';
import { Routes, Link, Route, useLocation } from 'react-router-dom';
import { useReactRouterEventTracker } from '@mcp-fe/react-event-tracker';
import { useStoredEvents } from './hooks/useStoredEvents';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useEffect, useState } from 'react';
import { SignJWT } from 'jose';

// Shared secret key (must match server's SECRET_KEY in auth.ts)
const SECRET_KEY = new TextEncoder().encode(
  'mcp-mock-secret-key-do-not-use-in-production',
);

/**
 * Creates a properly signed mock JWT token with the given sessionId
 * Uses HS256 signature algorithm with a shared secret key
 * This is for development/demo purposes only
 */
async function createMockJWT(sessionId: string): Promise<string> {
  return await new SignJWT({
    sub: sessionId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET_KEY);
}

export function App() {
  const { setAuthToken } = useReactRouterEventTracker();
  const { events } = useStoredEvents(1000);
  const location = useLocation();
  const isConnected = useConnectionStatus();
  const [sessionUser, setSessionUser] = useState<string>(() => {
    return (
      localStorage.getItem('mcp_session_user') ||
      'user_' + Math.random().toString(36).substring(7)
    );
  });

  useEffect(() => {
    localStorage.setItem('mcp_session_user', sessionUser);
    // Create mock JWT token client-side asynchronously
    createMockJWT(sessionUser)
      .then((mockJwt) => {
        localStorage.setItem('jwtTokenMock', mockJwt);
        setAuthToken(mockJwt);
      })
      .catch((err) => {
        console.error('Failed to create JWT token:', err);
      });
  }, [sessionUser, setAuthToken]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1>MCP Edge Demo</h1>
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
                  to="/dashboard"
                  className={location.pathname === '/dashboard' ? 'active' : ''}
                >
                  Dashboard
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
                  to="/components"
                  className={
                    location.pathname === '/components' ? 'active' : ''
                  }
                >
                  Components
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
              <li>
                <Link
                  to="/navigation"
                  className={
                    location.pathname === '/navigation' ? 'active' : ''
                  }
                >
                  Navigation
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div
          className="header-right"
          style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          <div className="session-info">
            User:{' '}
            <input
              value={sessionUser}
              onChange={(e) => setSessionUser(e.target.value)}
              style={{
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div
            className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}
          >
            <span className="dot"></span>
            {isConnected
              ? 'Connected to MCP Proxy'
              : 'Disconnected from MCP Proxy'}
          </div>
        </div>
      </header>

      <main className="main-layout">
        <section className="content-area">
          <div className="card">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/forms" element={<FormsPage />} />
              <Route path="/components" element={<ComponentsPage />} />
              <Route path="/data-table" element={<DataTablePage />} />
              <Route path="/navigation" element={<NavigationPage />} />
              <Route
                path="/page-2"
                element={
                  <div>
                    <h2>Page 2</h2>
                    <p>
                      This is another page to demonstrate navigation tracking.
                    </p>
                    <Link to="/">Back to Home</Link>
                  </div>
                }
              />
            </Routes>
          </div>

          <div className="card doc-section">
            <h2>How it works</h2>
            <p>
              This demo showcases the <strong>Service Worker MCP Edge</strong>{' '}
              pattern. Your interactions are tracked locally and stored in{' '}
              <code>IndexedDB</code> inside a Service Worker.
            </p>
            <div className="architecture-image">
              <img
                src="/assets/mcp-architecture.png"
                alt="MCP Architecture Diagram"
              />
            </div>
            <p>
              The Service Worker acts as an MCP Server. The data is{' '}
              <strong>never pushed</strong> to the server automatically.
              Instead, an AI Agent can <strong>pull</strong> it on-demand via
              the MCP server Proxy.
            </p>
          </div>
        </section>

        <aside className="sidebar">
          <div className="card">
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
    </div>
  );
}

export default App;
